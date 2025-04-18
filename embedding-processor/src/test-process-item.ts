import { processContentItem } from './processors/content-processor';
import { supabase } from './services/supabase';
import dotenv from 'dotenv';

dotenv.config();

// Take command line arguments: content_id and content_type
const args = process.argv.slice(2);
const contentId = args[0];
const contentType = args[1] as 'post' | 'comment';

if (!contentId || !contentType) {
  console.error('Usage: ts-node src/test-process-item.ts <content_id> <post|comment>');
  process.exit(1);
}

if (contentType !== 'post' && contentType !== 'comment') {
  console.error('Content type must be either "post" or "comment"');
  process.exit(1);
}

async function testProcessItem() {
  try {
    console.log(`Testing processing of ${contentType} ${contentId}...`);

    // Verify the content exists before attempting to process
    const { data, error } = await supabase
      .from(contentType === 'post' ? 'reddit_posts' : 'reddit_comments')
      .select('id')
      .eq('id', contentId)
      .single();

    if (error || !data) {
      console.error(`${contentType} with ID ${contentId} not found`);
      process.exit(1);
    }

    console.log(`Found ${contentType} ${contentId}, processing...`);
    
    // Process the item
    await processContentItem(contentId, contentType);
    
    console.log(`Successfully processed ${contentType} ${contentId}`);
    
    // Verify the representation was stored
    const { data: representation, error: repError } = await supabase
      .from('content_representations')
      .select('id, representation_type')
      .eq('parent_id', contentId)
      .eq('content_type', contentType);
      
    if (repError) {
      console.error('Error checking representation:', repError);
    } else if (representation && representation.length > 0) {
      console.log('Stored representations:');
      representation.forEach(rep => {
        console.log(`- ${rep.representation_type} (${rep.id})`);
      });
    } else {
      console.log('No representations stored. Processing may have failed.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error in test:', error);
    process.exit(1);
  }
}

testProcessItem(); 