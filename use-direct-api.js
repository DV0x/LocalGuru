/**
 * This script adds fallback direct API calls to your application
 * when Supabase Edge Functions fail.
 * It creates backup copies of your original files and updates them
 * with the new version that includes fallback direct API calls.
 */

const fs = require('fs');
const path = require('path');

// Files to update
const files = [
  {
    path: './app/lib/search/query-processor.ts',
    patches: [
      {
        // Replace generateEmbeddings function with an enhanced version
        search: /export async function generateEmbeddings\(query: string\): Promise<EmbeddingResult>\s*{[\s\S]+?}\s*catch\s*\(error\)\s*{[\s\S]+?}\s*}/,
        replace: `export async function generateEmbeddings(query: string): Promise<EmbeddingResult> {
  try {
    const { data, error } = await supabaseAdmin.functions.invoke('query-embeddings', {
      body: { query }
    });
    
    if (error) {
      throw new ApiError(\`Embedding generation failed: \${error.message}\`, 500);
    }
    
    if (!data || !data.embedding) {
      throw new ApiError('No embedding data returned', 500);
    }
    
    return data as EmbeddingResult;
  } catch (error) {
    console.error('Error generating embeddings: ', error);
    
    // Ensure we use the fallback for any Edge Function error
    return generateEmbeddingsWithFallback(query);
  }
}`
      },
      
      // Enhance the analyzeQuery function with direct API fallback
      {
        search: /export async function analyzeQuery\(query: string, defaultLocation\?: string\): Promise<QueryAnalysisResult>\s*{[\s\S]+?}\s*catch\s*\(error\)\s*{[\s\S]+?}\s*}/,
        replace: `export async function analyzeQuery(query: string, defaultLocation?: string): Promise<QueryAnalysisResult> {
  try {
    console.log(\`Analyzing query: "\${query}" \${defaultLocation ? \`(default: \${defaultLocation})\` : ''}\`);
    
    // First try the edge function
    try {
      const { data, error } = await supabaseAdmin.functions.invoke('query-analysis', {
        body: { 
          query,
          defaultLocation
        }
      });
      
      if (error) {
        throw new ApiError(\`Query analysis failed: \${error.message}\`, 500);
      }
      
      if (!data) {
        throw new ApiError('No analysis data returned', 500);
      }
      
      console.log(\`Intent: \${data.intent}, Topics: \${data.topics?.join(', ') || 'none'}, Locations: \${data.locations?.join(', ') || 'none'}\`);
      
      return data as QueryAnalysisResult;
    } catch (edgeError) {
      // If the edge function fails, use the direct API fallback
      console.warn('Query analysis edge function failed, using direct API fallback:', edgeError);
      
      // Use our hardcoded API key or environment variable
      const openaiApiKey = OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        throw new ApiError('No OpenAI API key available for fallback', 500);
      }
      
      // Direct OpenAI API call
      console.log('Using direct API for query analysis');
      const prompt = \`
Analyze the following search query and extract structured information about it:
"\${query}"

Provide your analysis in the following JSON format:
{
  "entities": {
    "product": ["product names mentioned"],
    "brand": ["brand names mentioned"],
    "feature": ["features mentioned"],
    "price_range": ["price ranges mentioned"],
    "attribute": ["any other attributes mentioned"]
  },
  "topics": ["list of general topics this query relates to"],
  "locations": ["any locations mentioned in the query"],
  "intent": "one of: recommendation, information, comparison, experience, local_events, how_to, discovery, general"
}

For "entities", only include categories that are actually present in the query.
For "intent":
- recommendation: user wants suggestions or recommendations
- information: user wants factual information
- comparison: user wants to compare options
- experience: user wants to compare experiences
- local_events: user is searching for local events or activities
- how_to: user is asking for instructions or guidance
- discovery: user is exploring or wanting to discover new options
- general: general queries that don't fit other categories

Pay special attention to dietary preferences (vegan, vegetarian, gluten-free) and include them in topics.

Provide only the JSON, with no additional text.
\`;

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": \`Bearer \${openaiApiKey}\`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          response_format: { type: "json_object" }
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(\`OpenAI API error: \${response.status} - \${errorText}\`);
      }
      
      const responseData = await response.json();
      const content = responseData.choices[0]?.message?.content || '{}';
      
      try {
        const result = JSON.parse(content);
        
        // Default values for missing fields
        const analysis: QueryAnalysisResult = {
          entities: result.entities || {},
          topics: result.topics || [],
          locations: result.locations || [],
          intent: result.intent || 'general',
        };
        
        // Add default location if no locations were found
        if (defaultLocation && (!analysis.locations || analysis.locations.length === 0)) {
          analysis.locations = [defaultLocation];
        }
        
        console.log(\`[Fallback Analysis] Intent: \${analysis.intent}, Topics: \${analysis.topics?.join(', ') || 'none'}, Locations: \${analysis.locations?.join(', ') || 'none'}\`);
        
        return analysis;
      } catch (parseError) {
        console.error('Error parsing OpenAI response:', parseError);
        throw new ApiError('Failed to parse query analysis response', 500);
      }
    }
  } catch (error) {
    console.error('Error in query analysis:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Failed to analyze query', 500);
  }
}`
      }
    ]
  }
];

// Process each file
files.forEach(file => {
  const filePath = path.resolve(process.cwd(), file.path);
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }
  
  // Create backup
  const backupPath = `${filePath}.backup`;
  fs.copyFileSync(filePath, backupPath);
  console.log(`Created backup: ${backupPath}`);
  
  // Read file content
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Apply patches
  file.patches.forEach((patch, index) => {
    if (content.match(patch.search)) {
      content = content.replace(patch.search, patch.replace);
      console.log(`Applied patch #${index + 1} to ${file.path}`);
    } else {
      console.error(`Pattern not found for patch #${index + 1} in ${file.path}`);
    }
  });
  
  // Write updated content
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${file.path}`);
});

console.log('\nUpdates complete. Restart your application with:');
console.log('npm run dev');
console.log('\nIf you need to restore from backup:');
files.forEach(file => {
  console.log(`cp ${file.path}.backup ${file.path}`);
});