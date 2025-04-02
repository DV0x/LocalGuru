// comprehensive-metadata-fix.ts
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import fetch from 'node-fetch'
import pkg from 'pg';
const { Pool } = pkg;

// Load environment variables
dotenv.config()

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BATCH_SIZE = 20
const PARALLEL_BATCHES = 3
const DELAY_BETWEEN_BATCHES = 3000
const MAX_RETRIES = 3

// Initialize clients
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const pool = new Pool({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL })

// Get unique content IDs that need processing - COMPREHENSIVE QUERY
async function getContentIdsToProcess(limit: number, offset: number) {
  // Find ALL content with ANY empty metadata fields
  const result = await pool.query(`
    WITH ranked_records AS (
      SELECT 
        parent_id,
        content_type,
        ROW_NUMBER() OVER (PARTITION BY parent_id, content_type ORDER BY id) as rn
      FROM content_representations
      WHERE metadata->>'entities' = '{}'
         OR metadata->>'topics' = '[]'
         OR metadata->>'semanticTags' = '[]'
         OR metadata->>'semanticTags' IS NULL
    )
    SELECT parent_id, content_type
    FROM ranked_records
    WHERE rn = 1
    ORDER BY parent_id
    LIMIT $1 OFFSET $2
  `, [limit, offset])
  
  return result.rows
}

// Process with retries
async function reprocessContentWithRetry(contentId: string, contentType: string, retries = 0): Promise<any> {
  try {
    console.log(`Reprocessing ${contentType} with ID: ${contentId}${retries > 0 ? ` (Retry ${retries}/${MAX_RETRIES})` : ''}`)
    
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/enhanced-embeddings`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          contentId,
          contentType,
          includeContext: true,
          refreshRepresentations: true // This will update ALL representations
        }),
        signal: AbortSignal.timeout(120000) // 2 minute timeout
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Error calling enhanced-embeddings: ${response.status} ${errorText}`)
    }

    const result = await response.json()
    console.log(`✅ Successfully updated metadata for ${contentType} ${contentId}`)
    return result
  } catch (error) {
    console.error(`❌ Error updating metadata for ${contentType} ${contentId}:`, error)
    
    // Implement retry logic
    if (retries < MAX_RETRIES) {
      console.log(`🔄 Retrying ${contentType} ${contentId} in 5 seconds...`)
      await new Promise(resolve => setTimeout(resolve, 5000))
      return reprocessContentWithRetry(contentId, contentType, retries + 1)
    }
    
    return { success: false, error: String(error) }
  }
}

// Process a batch of content IDs
async function processBatch(records: any[]) {
  const results = []
  
  for (const record of records) {
    const result = await reprocessContentWithRetry(record.parent_id, record.content_type)
    results.push({
      contentId: record.parent_id,
      contentType: record.content_type,
      success: result && result.success !== false
    })
  }
  
  return results
}

// Verification function
async function verifyFixedRecords() {
  console.log('\n🔍 Verifying results...')
  
  const result = await pool.query(`
    SELECT 
      COUNT(*) as total_records,
      COUNT(*) FILTER (WHERE metadata->>'entities' = '{}') as empty_entities,
      COUNT(*) FILTER (WHERE metadata->>'topics' = '[]') as empty_topics,
      COUNT(*) FILTER (WHERE metadata->>'semanticTags' IS NULL OR metadata->>'semanticTags' = '[]') as empty_tags
    FROM content_representations
  `)
  
  const stats = result.rows[0]
  console.log('📊 Verification results:')
  console.log(`- Total records: ${stats.total_records}`)
  console.log(`- Records with empty entities: ${stats.empty_entities} (${Math.round((stats.empty_entities/stats.total_records)*100)}%)`)
  console.log(`- Records with empty topics: ${stats.empty_topics} (${Math.round((stats.empty_topics/stats.total_records)*100)}%)`)
  console.log(`- Records with empty semantic tags: ${stats.empty_tags} (${Math.round((stats.empty_tags/stats.total_records)*100)}%)`)
  
  return {
    totalRecords: Number(stats.total_records),
    emptyEntities: Number(stats.empty_entities),
    emptyTopics: Number(stats.empty_topics),
    emptyTags: Number(stats.empty_tags)
  }
}

// Main function
async function main() {
  try {
    console.log('🔍 Checking connection to database...')
    await pool.query('SELECT NOW()')
    console.log('✅ Database connection successful')
    
    // Initial stats
    const initialStats = await verifyFixedRecords()
    
    // Get total count of unique content IDs to process
    const countResult = await pool.query(`
      WITH problem_content AS (
        SELECT DISTINCT parent_id, content_type
        FROM content_representations
        WHERE metadata->>'entities' = '{}'
           OR metadata->>'topics' = '[]'
           OR metadata->>'semanticTags' = '[]'
           OR metadata->>'semanticTags' IS NULL
      )
      SELECT COUNT(*) as count FROM problem_content
    `)
    const totalUniqueContents = parseInt(countResult.rows[0].count)
    console.log(`🔢 Found ${totalUniqueContents} unique content items that need metadata fixed`)
    
    let offset = 0
    let processedCount = 0
    let successCount = 0
    
    console.log(`\n🚀 Starting comprehensive metadata fix with ${PARALLEL_BATCHES} parallel batches of ${BATCH_SIZE} items each`)
    
    const startTime = Date.now()
    
    while (offset < totalUniqueContents) {
      // Get batch of unique content IDs
      const contentRecords = await getContentIdsToProcess(BATCH_SIZE * PARALLEL_BATCHES, offset)
      if (contentRecords.length === 0) break
      
      console.log(`\n📦 Processing batch of ${contentRecords.length} unique content items (${offset+1}-${offset+contentRecords.length} of ${totalUniqueContents})`)
      
      // Split into parallel batches
      const parallelBatches = []
      for (let i = 0; i < contentRecords.length; i += BATCH_SIZE) {
        const batchRecords = contentRecords.slice(i, i + BATCH_SIZE)
        parallelBatches.push(processBatch(batchRecords))
      }
      
      // Process batches in parallel
      const batchResults = await Promise.all(parallelBatches)
      const results = batchResults.flat()
      
      // Update counters
      processedCount += results.length
      const batchSuccessCount = results.filter(r => r.success).length
      successCount += batchSuccessCount
      
      // Show progress
      const progressPercent = Math.round((processedCount / totalUniqueContents) * 100)
      const elapsedMinutes = (Date.now() - startTime) / 60000
      const estimatedTotalMinutes = (elapsedMinutes / progressPercent) * 100
      const estimatedRemainingMinutes = estimatedTotalMinutes - elapsedMinutes
      
      console.log(`✅ Batch completed: ${batchSuccessCount}/${results.length} successful`)
      console.log(`📊 Overall progress: ${processedCount}/${totalUniqueContents} processed (${progressPercent}%), ${successCount} successful`)
      console.log(`⏱️ Elapsed time: ${elapsedMinutes.toFixed(1)} minutes, Estimated remaining: ~${estimatedRemainingMinutes.toFixed(1)} minutes`)
      
      // Update offset for next batch
      offset += contentRecords.length
      
      // Delay between batches if more remaining
      if (offset < totalUniqueContents) {
        console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES/1000}s before next batch...`)
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
      }
    }
    
    console.log(`\n✨ Metadata fix completed: ${successCount}/${processedCount} successful (${Math.round((successCount/processedCount)*100)}% success rate)`)
    
    // Final verification
    const finalStats = await verifyFixedRecords()
    
    // Improvements report
    console.log('\n📈 Improvements:')
    console.log(`- Records with empty entities: ${initialStats.emptyEntities} → ${finalStats.emptyEntities} (${Math.round((initialStats.emptyEntities - finalStats.emptyEntities) / initialStats.emptyEntities * 100)}% reduction)`)
    console.log(`- Records with empty topics: ${initialStats.emptyTopics} → ${finalStats.emptyTopics} (${Math.round((initialStats.emptyTopics - finalStats.emptyTopics) / initialStats.emptyTopics * 100)}% reduction)`)
    console.log(`- Records with empty tags: ${initialStats.emptyTags} → ${finalStats.emptyTags} (${Math.round((initialStats.emptyTags - finalStats.emptyTags) / initialStats.emptyTags * 100)}% reduction)`)
    
  } catch (error) {
    console.error('❌ Error in metadata fix process:', error)
  } finally {
    await pool.end()
    console.log('🔌 Database connection closed')
  }
}

main()