# Database Security Implementation Plan

This plan outlines specific steps to secure your database infrastructure for LocalGuru.

## 1. Vector Embeddings Protection

### Priority: High
### Timeline: First week

**Implementation Steps:**

1. **Create an API-specific role in Supabase:**
   ```sql
   CREATE ROLE search_api;
   ```

2. **Enable Row Level Security on embedding tables:**
   ```sql
   ALTER TABLE content_representations ENABLE ROW LEVEL SECURITY;
   ALTER TABLE embedding_cache ENABLE ROW LEVEL SECURITY;
   ```

3. **Define access policy for embeddings:**
   ```sql
   -- Only allow the search API role to access embeddings
   CREATE POLICY "Limit embedding access" 
   ON content_representations
   FOR SELECT USING (auth.role() = 'search_api');
   
   -- Limit direct access to embedding cache
   CREATE POLICY "Limit cache access" 
   ON embedding_cache
   FOR SELECT USING (auth.role() = 'search_api');
   ```

4. **Verify policy implementation:**
   ```sql
   -- Test queries to confirm policies are working
   SET ROLE anonymous;
   SELECT * FROM content_representations LIMIT 1; -- Should fail
   
   SET ROLE search_api;
   SELECT * FROM content_representations LIMIT 1; -- Should succeed
   ```

## 2. Access Control Implementation

### Priority: High
### Timeline: First week

**Implementation Steps:**

1. **Enable Row Level Security on all content tables:**
   ```sql
   ALTER TABLE reddit_posts ENABLE ROW LEVEL SECURITY;
   ALTER TABLE reddit_comments ENABLE ROW LEVEL SECURITY;
   ALTER TABLE reddit_users ENABLE ROW LEVEL SECURITY;
   ALTER TABLE content_chunks ENABLE ROW LEVEL SECURITY;
   ```

2. **Create public access policies:**
   ```sql
   -- Policy for public read access to appropriate content
   CREATE POLICY "Public read for safe content" 
   ON reddit_posts
   FOR SELECT USING (is_nsfw = false AND is_removed = false);
   
   -- Similar policy for comments
   CREATE POLICY "Public read for comments" 
   ON reddit_comments
   FOR SELECT USING (is_removed = false);
   ```

3. **Create admin-only policies:**
   ```sql
   -- Only admins can modify content
   CREATE POLICY "Admin content management" 
   ON reddit_posts
   FOR ALL USING (auth.role() = 'admin');
   
   CREATE POLICY "Admin comment management" 
   ON reddit_comments
   FOR ALL USING (auth.role() = 'admin');
   ```

4. **Add logging for policy violations:**
   ```sql
   -- Create audit log table
   CREATE TABLE security_audit_log (
     id SERIAL PRIMARY KEY,
     event_time TIMESTAMPTZ DEFAULT NOW(),
     user_id TEXT,
     event_type TEXT,
     description TEXT,
     ip_address TEXT
   );
   
   -- Create trigger function for logging
   CREATE OR REPLACE FUNCTION log_security_event()
   RETURNS TRIGGER AS $$
   BEGIN
     INSERT INTO security_audit_log (user_id, event_type, description)
     VALUES (auth.uid(), 'POLICY_VIOLATION', 'Attempted unauthorized access');
     RETURN NULL;
   END;
   $$ LANGUAGE plpgsql;
   ```

## 3. User Data Privacy

### Priority: Medium
### Timeline: Second week

**Implementation Steps:**

1. **Audit user data storage:**
   ```sql
   -- Review what user data is stored
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'reddit_users';
   ```

2. **Implement pseudonymization:**
   ```sql
   -- Add function to hash PII
   CREATE OR REPLACE FUNCTION hash_identifier(text)
   RETURNS text AS $$
     SELECT encode(digest($1, 'sha256'), 'hex');
   $$ LANGUAGE SQL IMMUTABLE;
   
   -- Update existing data (one-time operation)
   UPDATE reddit_users
   SET username = hash_identifier(username)
   WHERE username IS NOT NULL;
   ```

3. **Create data deletion mechanism:**
   ```sql
   -- Function to handle user deletion requests
   CREATE OR REPLACE FUNCTION delete_user_data(user_id_to_delete TEXT)
   RETURNS VOID AS $$
   BEGIN
     -- Delete or anonymize user data
     UPDATE reddit_posts
     SET author_id = 'deleted', content = '[Content removed]'
     WHERE author_id = user_id_to_delete;
     
     UPDATE reddit_comments
     SET author_id = 'deleted', content = '[Content removed]'
     WHERE author_id = user_id_to_delete;
     
     DELETE FROM reddit_users
     WHERE id = user_id_to_delete;
   END;
   $$ LANGUAGE plpgsql;
   ```

4. **Create privacy policy document and endpoints:**
   - Document what data is collected and why
   - Provide a way for users to request data deletion
   - Create API endpoint that calls the deletion function

## 4. SQL Injection Prevention

### Priority: Critical
### Timeline: Immediate

**Implementation Steps:**

1. **Audit existing database functions:**
   ```sql
   SELECT routine_name, routine_definition
   FROM information_schema.routines
   WHERE routine_schema = 'public'
   AND routine_definition LIKE '%||%'
   OR routine_definition LIKE '%concatenat%';
   ```

2. **Replace direct concatenation with parameterized queries:**
   ```sql
   -- BAD:
   -- 'SELECT * FROM posts WHERE title = ''' || user_input || ''''
   
   -- GOOD:
   CREATE OR REPLACE FUNCTION search_posts(p_query TEXT)
   RETURNS SETOF reddit_posts AS $$
   BEGIN
     RETURN QUERY
     SELECT * FROM reddit_posts
     WHERE title = p_query;  -- Parameter automatically handled safely
   END;
   $$ LANGUAGE plpgsql;
   ```

3. **Add input validation at database level:**
   ```sql  
   CREATE OR REPLACE FUNCTION validate_search_input(input TEXT)
   RETURNS BOOLEAN AS $$
   BEGIN
     -- Check for common SQL injection patterns
     IF input ~ '[;]' OR input ~ '--' OR input ~ '/\*' THEN
       RETURN FALSE;
     END IF;
     RETURN TRUE;
   END;
   $$ LANGUAGE plpgsql;
   
   -- Use in functions
   CREATE OR REPLACE FUNCTION safe_search(p_query TEXT)
   RETURNS SETOF reddit_posts AS $$
   BEGIN
     IF NOT validate_search_input(p_query) THEN
       RAISE EXCEPTION 'Invalid input detected';
     END IF;
     
     RETURN QUERY
     SELECT * FROM reddit_posts
     WHERE title = p_query;
   END;
   $$ LANGUAGE plpgsql;
   ```

4. **Implement prepared statement pattern in all database functions:**
   - Review all search functions
   - Convert to parameterized queries
   - Test with potential malicious inputs

## Monitoring and Verification

1. **Create a database security dashboard:**
   ```sql
   CREATE VIEW security_metrics AS
   SELECT 
     COUNT(*) AS total_policy_violations,
     DATE_TRUNC('day', event_time) AS day,
     event_type
   FROM security_audit_log
   GROUP BY day, event_type
   ORDER BY day DESC;
   ```

2. **Implement regular security audits:**
   - Schedule monthly reviews of database access patterns
   - Check for unusual query patterns
   - Verify RLS policies are working as expected

3. **Set up alerts for potential security issues:**
   ```sql
   CREATE OR REPLACE FUNCTION alert_on_multiple_violations()
   RETURNS TRIGGER AS $$
   BEGIN
     -- Check for repeated violations
     IF (SELECT COUNT(*) FROM security_audit_log 
         WHERE user_id = NEW.user_id 
         AND event_time > NOW() - INTERVAL '1 hour') > 5 THEN
       -- Send alert (implement notification mechanism)
       PERFORM pg_notify('security_channel', 'Multiple violations by user ' || NEW.user_id);
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
   
   CREATE TRIGGER violation_alert_trigger
   AFTER INSERT ON security_audit_log
   FOR EACH ROW
   EXECUTE FUNCTION alert_on_multiple_violations();
   ``` 