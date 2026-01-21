-- Photo Upload Feature Migration
-- Add photo tables for apiaries, hives, and queens

-- Apiary Photos
CREATE TABLE apiary_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    apiary_id UUID NOT NULL REFERENCES apiaries(id) ON DELETE CASCADE,
    storage_key VARCHAR(500), -- Path/key in object storage or NULL if stored as bytea
    storage_type VARCHAR(50) DEFAULT 'bytea' CHECK (storage_type IN ('bytea', 's3', 'local')),
    thumbnail_storage_key VARCHAR(500),
    width INTEGER,
    height INTEGER,
    bytes INTEGER, -- File size in bytes
    mime_type VARCHAR(50) DEFAULT 'image/jpeg',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_apiary_photos_org_id ON apiary_photos(org_id);
CREATE INDEX idx_apiary_photos_apiary_id ON apiary_photos(apiary_id);

-- Hive Photos
CREATE TABLE hive_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    hive_id UUID NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    storage_key VARCHAR(500), -- Path/key in object storage or NULL if stored as bytea
    storage_type VARCHAR(50) DEFAULT 'bytea' CHECK (storage_type IN ('bytea', 's3', 'local')),
    thumbnail_storage_key VARCHAR(500),
    width INTEGER,
    height INTEGER,
    bytes INTEGER, -- File size in bytes
    mime_type VARCHAR(50) DEFAULT 'image/jpeg',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_hive_photos_org_id ON hive_photos(org_id);
CREATE INDEX idx_hive_photos_hive_id ON hive_photos(hive_id);

-- Queen Photos
CREATE TABLE queen_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    queen_id UUID NOT NULL REFERENCES queen_records(id) ON DELETE CASCADE,
    storage_key VARCHAR(500), -- Path/key in object storage or NULL if stored as bytea
    storage_type VARCHAR(50) DEFAULT 'bytea' CHECK (storage_type IN ('bytea', 's3', 'local')),
    thumbnail_storage_key VARCHAR(500),
    width INTEGER,
    height INTEGER,
    bytes INTEGER, -- File size in bytes
    mime_type VARCHAR(50) DEFAULT 'image/jpeg',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_queen_photos_org_id ON queen_photos(org_id);
CREATE INDEX idx_queen_photos_queen_id ON queen_photos(queen_id);
