-- Test script for the text_search function (can be run directly on the database)

-- Basic search
SELECT * FROM public.text_search('machine learning');

-- Search with subreddit filter
SELECT * FROM public.text_search('AI', 'machinelearning');

-- Search with limited results
SELECT * FROM public.text_search('programming', NULL, 5);

-- Search and check which results are chunks vs. full documents
SELECT 
  content_type,
  is_chunk,
  COUNT(*) 
FROM public.text_search('data science')
GROUP BY content_type, is_chunk
ORDER BY content_type, is_chunk; 