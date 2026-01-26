-- Hive Splits Migration
-- Adds support for tracking hive splits and nucleus colony creation

-- Hive Splits table
CREATE TABLE IF NOT EXISTS hive_splits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    parent_hive_id UUID NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    split_date DATE NOT NULL,
    split_method VARCHAR(50) DEFAULT 'walk_away' CHECK (split_method IN ('walk_away', 'queen_cell', 'queen_introduction', 'nuc_creation', 'other')),
    frames_moved INTEGER DEFAULT 0,
    brood_frames INTEGER DEFAULT 0,
    honey_frames INTEGER DEFAULT 0,
    pollen_frames INTEGER DEFAULT 0,
    queen_source VARCHAR(50) CHECK (queen_source IN ('parent_hive', 'purchased', 'grafted', 'cell', 'unknown')),
    queen_id UUID REFERENCES queen_records(id) ON DELETE SET NULL,
    notes TEXT,
    created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_hive_splits_org_id ON hive_splits(org_id);
CREATE INDEX idx_hive_splits_parent_hive_id ON hive_splits(parent_hive_id);
CREATE INDEX idx_hive_splits_split_date ON hive_splits(split_date DESC);
CREATE INDEX idx_hive_splits_created_by_user_id ON hive_splits(created_by_user_id);

-- Split Hive Relationships table (links splits to child hives created from them)
CREATE TABLE IF NOT EXISTS split_hive_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    split_id UUID NOT NULL REFERENCES hive_splits(id) ON DELETE CASCADE,
    child_hive_id UUID NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(split_id, child_hive_id)
);

CREATE INDEX idx_split_hive_relationships_split_id ON split_hive_relationships(split_id);
CREATE INDEX idx_split_hive_relationships_child_hive_id ON split_hive_relationships(child_hive_id);

-- Add optional split_id column to hives table to track if hive was created from a split
ALTER TABLE hives ADD COLUMN IF NOT EXISTS split_id UUID REFERENCES hive_splits(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_hives_split_id ON hives(split_id);
