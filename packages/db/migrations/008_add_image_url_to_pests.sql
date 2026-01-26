-- Add image_url column to pest_knowledge_base table
-- This allows storing image URLs for pest images uploaded to Cloudinary

ALTER TABLE pest_knowledge_base
ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);

-- Add comment to document the column
COMMENT ON COLUMN pest_knowledge_base.image_url IS 'URL to the pest image stored in Cloudinary';
