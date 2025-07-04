-- Add is_main_document field to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS is_main_document BOOLEAN DEFAULT FALSE;

-- Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_documents_main ON documents(project_id, is_main_document) WHERE is_main_document = TRUE;

-- Ensure only one main document per project
CREATE OR REPLACE FUNCTION enforce_single_main_document()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_main_document = TRUE THEN
    -- Reset any existing main document for this project
    UPDATE documents 
    SET is_main_document = FALSE 
    WHERE project_id = NEW.project_id 
      AND id != NEW.id 
      AND is_main_document = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce single main document
DROP TRIGGER IF EXISTS enforce_single_main_document_trigger ON documents;
CREATE TRIGGER enforce_single_main_document_trigger
BEFORE INSERT OR UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION enforce_single_main_document();