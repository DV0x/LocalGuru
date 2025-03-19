-- Migration: Create content functions and triggers for automatic embeddings
-- Description: Sets up automatic embedding generation for reddit posts and comments

-- Function to generate input for post embeddings
CREATE OR REPLACE FUNCTION public.post_embedding_input(post_record reddit_posts)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT post_record.title || ' ' || COALESCE(post_record.content, '');
$$;

-- Function to generate input for comment embeddings
CREATE OR REPLACE FUNCTION public.comment_embedding_input(comment_record reddit_comments)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT comment_record.content;
$$;

-- Trigger to queue embeddings for new posts
CREATE TRIGGER embed_posts_on_insert
  AFTER INSERT ON reddit_posts
  FOR EACH ROW
  EXECUTE FUNCTION util.queue_embeddings('post_embedding_input', 'embedding');

-- Trigger to queue embeddings when post content is updated
CREATE TRIGGER embed_posts_on_update
  AFTER UPDATE OF title, content ON reddit_posts
  FOR EACH ROW
  WHEN (OLD.title IS DISTINCT FROM NEW.title OR OLD.content IS DISTINCT FROM NEW.content)
  EXECUTE FUNCTION util.queue_embeddings('post_embedding_input', 'embedding');

-- Trigger to clear post embedding on content update
CREATE TRIGGER clear_post_embedding_on_update
  BEFORE UPDATE OF title, content ON reddit_posts
  FOR EACH ROW
  WHEN (OLD.title IS DISTINCT FROM NEW.title OR OLD.content IS DISTINCT FROM NEW.content)
  EXECUTE FUNCTION util.clear_column('embedding');

-- Trigger to queue embeddings for new comments
CREATE TRIGGER embed_comments_on_insert
  AFTER INSERT ON reddit_comments
  FOR EACH ROW
  EXECUTE FUNCTION util.queue_embeddings('comment_embedding_input', 'embedding');

-- Trigger to queue embeddings when comment content is updated
CREATE TRIGGER embed_comments_on_update
  AFTER UPDATE OF content ON reddit_comments
  FOR EACH ROW
  WHEN (OLD.content IS DISTINCT FROM NEW.content)
  EXECUTE FUNCTION util.queue_embeddings('comment_embedding_input', 'embedding');

-- Trigger to clear comment embedding on content update
CREATE TRIGGER clear_comment_embedding_on_update
  BEFORE UPDATE OF content ON reddit_comments
  FOR EACH ROW
  WHEN (OLD.content IS DISTINCT FROM NEW.content)
  EXECUTE FUNCTION util.clear_column('embedding'); 