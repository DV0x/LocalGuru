-- Seed data for local development

-- Add project URL secret for local development
SELECT vault.create_secret('http://api.supabase.internal:8000', 'project_url'); 