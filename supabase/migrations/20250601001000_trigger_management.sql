-- Migration: Create function to enable/disable triggers
-- Description: Adds a function to allow programmatically enabling/disabling triggers on specific tables

-- Function to enable or disable all triggers on a table
CREATE OR REPLACE FUNCTION public.alter_triggers(
  table_name TEXT,
  enable BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF enable THEN
    EXECUTE format('ALTER TABLE %I ENABLE TRIGGER ALL', table_name);
  ELSE
    EXECUTE format('ALTER TABLE %I DISABLE TRIGGER ALL', table_name);
  END IF;
END;
$$;

-- Grant execute permissions to service role
GRANT EXECUTE ON FUNCTION public.alter_triggers TO service_role; 