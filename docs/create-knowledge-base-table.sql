-- Create company knowledge base table
CREATE TABLE IF NOT EXISTS company_knowledge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  content TEXT,
  metadata TEXT,
  file_type TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(category, filename)
);

-- Add category validation trigger
CREATE TRIGGER IF NOT EXISTS validate_category
BEFORE INSERT ON company_knowledge
FOR EACH ROW
WHEN NEW.category NOT IN ('won_proposals', 'sow', 'k12_erate', 'engineering', 'project_plans', 'legal', 'other')
BEGIN
  SELECT RAISE(FAIL, 'Invalid category');
END;