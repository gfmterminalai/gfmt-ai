-- Function to execute SQL scripts
CREATE OR REPLACE FUNCTION init_schema(sql_script TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE sql_script;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 