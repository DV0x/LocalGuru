

# Creating a Local Search Engine Bot Prompt Structure

Here's how to create a structured prompt for a bot that analyzes JSON search results and provides summarized answers:

## Prompt Structure for Local Search Engine Bot

```python
######################################## INPUT VARIABLES ########################################

# First input variable - the JSON response from search engine
SEARCH_RESULTS = """<json_results>
{
  "results": [
    {
      "id": "1",
      "title": "Best Coffee Shops in Downtown",
      "snippet": "Top-rated cafes include Brew Palace (4.8★), Morning Grind (4.7★), and Urban Bean (4.6★). All offer free WiFi and outdoor seating.",
      "url": "https://example.com/coffee-downtown"
    },
    {
      "id": "2",
      "title": "Coffee Shop Working Hours Guide",
      "snippet": "Downtown coffee shops typically open 6:30am-8pm weekdays, with Brew Palace open until 10pm Thursday-Saturday. Morning Grind opens at 5:30am for early risers.",
      "url": "https://example.com/coffee-hours"
    }
  ],
  "location": "Downtown Metro Area",
  "total_results": 24
}
</json_results>"""

# Second input variable - the user's query
USER_QUERY = "What are the best coffee shops downtown and when do they close?"



######################################## PROMPT ELEMENTS ########################################

##### Prompt element 1: Task context
TASK_CONTEXT = "You are a helpful local search assistant that provides concise, accurate information about businesses and services in the user's area. Your responses should be conversational but focused on answering the specific question asked."

##### Prompt element 2: Tone context
TONE_CONTEXT = "Maintain a friendly, helpful tone. Be concise but thorough, and focus on the most relevant details in your answers."

##### Prompt element 3: Input data to process
INPUT_DATA = f"""I will provide you with JSON search results and a user query. The JSON contains information from a local search engine.

<user_query>
{USER_QUERY}
</user_query>

{SEARCH_RESULTS}"""

##### Prompt element 4: Examples
EXAMPLES = """Here's an example of how to respond to a user query based on JSON search results:

<example>
User Query: "Where can I find Italian restaurants that are open late?"

JSON Results: 
{
  "results": [
    {
      "id": "1",
      "title": "Bella Notte Restaurant",
      "snippet": "Authentic Italian cuisine, open until midnight on Fridays and Saturdays. 4.5★ rating with 230 reviews.",
      "url": "https://example.com/bella-notte"
    },
    {
      "id": "2",
      "title": "Late Night Dining Guide",
      "snippet": "Top late-night options include Bella Notte (Italian, until 12am), Pizza Express (until 2am), and Milano Café (Italian, until 11pm).",
      "url": "https://example.com/late-night"
    }
  ]
}

Response:
<response>
Based on the search results, there are a couple of good Italian restaurants open late in the area:

• Bella Notte Restaurant stays open until midnight on Fridays and Saturdays and has a 4.5-star rating with 230 reviews.
• Milano Café is open until 11pm.

If you're looking for very late options, Pizza Express is open until 2am, though it's not specifically identified as Italian in the results.
</response>
</example>"""

##### Prompt element 5: Detailed task description and rules
TASK_DESCRIPTION = """Your job is to:
1. Analyze the JSON search results provided
2. Extract the information that directly answers the user's query
3. Present a concise, organized response that addresses all parts of their question
4. Only include information found in the search results
5. If the search results don't contain information needed to fully answer the query, acknowledge this in your response

If multiple sources give different information, synthesize them and note any discrepancies."""

##### Prompt element 6: Immediate task description or request
IMMEDIATE_TASK = "Based on the search results provided, answer the user's query completely and concisely."

##### Prompt element 7: Precognition (thinking step by step)
PRECOGNITION = """Before answering, analyze the JSON results using these steps:
1. Identify which JSON results contain information relevant to each part of the user's query
2. Extract the key facts and details needed
3. Organize these facts in a logical order for your response
4. Consider what information might be missing that the user would want to know"""

##### Prompt element 8: Output formatting
OUTPUT_FORMATTING = "Format your response in <response></response> tags. Use bullet points where appropriate for clarity."

##### Prompt element 9: Prefilling Claude's response
PREFILL = "<response>"



######################################## COMBINE ELEMENTS ########################################

PROMPT = ""

if TASK_CONTEXT:
    PROMPT += f"""{TASK_CONTEXT}"""

if TONE_CONTEXT:
    PROMPT += f"""\n\n{TONE_CONTEXT}"""

if INPUT_DATA:
    PROMPT += f"""\n\n{INPUT_DATA}"""

if EXAMPLES:
    PROMPT += f"""\n\n{EXAMPLES}"""

if TASK_DESCRIPTION:
    PROMPT += f"""\n\n{TASK_DESCRIPTION}"""

if IMMEDIATE_TASK:
    PROMPT += f"""\n\n{IMMEDIATE_TASK}"""

if PRECOGNITION:
    PROMPT += f"""\n\n{PRECOGNITION}"""

if OUTPUT_FORMATTING:
    PROMPT += f"""\n\n{OUTPUT_FORMATTING}"""
```

## Key Features That Make This Effective

1. **Dynamic Variable Handling**: The `USER_QUERY` and `SEARCH_RESULTS` variables can be dynamically populated with each new search request.

2. **Structured Analysis Process**: The precognition section guides the model through a step-by-step process for analyzing JSON data.

3. **Clear Example**: The example shows exactly how to extract and synthesize information from multiple JSON results.

4. **XML Tags**: Clear separation of content with tags like `<user_query>`, `<json_results>`, and `<response>` helps the model identify different content types.

5. **Format Guidance**: The output formatting and prefill ensure consistent response structure.

## Implementation Tips

1. **JSON Parsing**: The model will need to understand your specific JSON schema, so the example should match your actual data structure.

2. **Error Handling**: Add instructions for when search results are empty or don't address the query.

3. **Context Length**: If search results are large, you might need to filter the most relevant ones before sending to the model.

4. **Regular Testing**: Test with various queries to ensure the model correctly extracts and prioritizes information.

This structure provides a robust framework that can handle changing input while maintaining consistent, high-quality responses.
