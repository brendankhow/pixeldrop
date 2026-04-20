-- Add file_paths array column for multiple deliverable files per product.
-- file_path is kept for backward compatibility; new uploads populate file_paths.
ALTER TABLE products ADD COLUMN IF NOT EXISTS file_paths text[] default '{}';
