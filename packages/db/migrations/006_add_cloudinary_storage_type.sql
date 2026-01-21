-- Add 'cloudinary' to storage_type check constraint for all photo tables

-- Update apiary_photos
ALTER TABLE apiary_photos 
DROP CONSTRAINT IF EXISTS apiary_photos_storage_type_check;

ALTER TABLE apiary_photos
ADD CONSTRAINT apiary_photos_storage_type_check 
CHECK (storage_type IN ('bytea', 's3', 'local', 'cloudinary'));

-- Update hive_photos
ALTER TABLE hive_photos 
DROP CONSTRAINT IF EXISTS hive_photos_storage_type_check;

ALTER TABLE hive_photos
ADD CONSTRAINT hive_photos_storage_type_check 
CHECK (storage_type IN ('bytea', 's3', 'local', 'cloudinary'));

-- Update queen_photos
ALTER TABLE queen_photos 
DROP CONSTRAINT IF EXISTS queen_photos_storage_type_check;

ALTER TABLE queen_photos
ADD CONSTRAINT queen_photos_storage_type_check 
CHECK (storage_type IN ('bytea', 's3', 'local', 'cloudinary'));

-- Update inspection_photos if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inspection_photos') THEN
        ALTER TABLE inspection_photos 
        DROP CONSTRAINT IF EXISTS inspection_photos_storage_type_check;

        ALTER TABLE inspection_photos
        ADD CONSTRAINT inspection_photos_storage_type_check 
        CHECK (storage_type IN ('bytea', 's3', 'local', 'cloudinary'));
    END IF;
END $$;
