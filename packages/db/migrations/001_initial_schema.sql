-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organisations
CREATE TABLE organisations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'manager', 'inspector', 'viewer')),
    password_hash VARCHAR(255), -- NULL if using auth_provider
    auth_provider VARCHAR(50), -- 'password', 'magic_link', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_org_id ON users(org_id);
CREATE INDEX idx_users_email ON users(email);

-- Apiaries
CREATE TABLE apiaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_apiaries_org_id ON apiaries(org_id);

-- Hives
CREATE TABLE hives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    apiary_id UUID REFERENCES apiaries(id) ON DELETE SET NULL,
    public_id VARCHAR(50) NOT NULL UNIQUE, -- For NFC URL deep-linking
    label VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'retired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_hives_org_id ON hives(org_id);
CREATE INDEX idx_hives_apiary_id ON hives(apiary_id);
CREATE INDEX idx_hives_public_id ON hives(public_id);

-- Inspections
CREATE TABLE inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    hive_id UUID NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    inspector_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    location_accuracy_m DECIMAL(10, 2),
    offline_created_at TIMESTAMP WITH TIME ZONE, -- When created offline (client timestamp)
    client_uuid UUID UNIQUE, -- For offline sync deduplication
    locked_at TIMESTAMP WITH TIME ZONE, -- When inspection was finalized/synced
    sections_json JSONB, -- Stores all inspection sections (queen, brood, strength, etc.)
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_inspections_org_id ON inspections(org_id);
CREATE INDEX idx_inspections_hive_id ON inspections(hive_id);
CREATE INDEX idx_inspections_inspector_user_id ON inspections(inspector_user_id);
CREATE INDEX idx_inspections_client_uuid ON inspections(client_uuid);
CREATE INDEX idx_inspections_started_at ON inspections(started_at DESC);

-- Inspection Photos
CREATE TABLE inspection_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    storage_key VARCHAR(500), -- Path/key in object storage or NULL if stored as bytea
    storage_type VARCHAR(50) DEFAULT 'bytea' CHECK (storage_type IN ('bytea', 's3', 'local')),
    thumbnail_storage_key VARCHAR(500),
    width INTEGER,
    height INTEGER,
    bytes INTEGER, -- File size in bytes
    mime_type VARCHAR(50) DEFAULT 'image/jpeg',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_inspection_photos_org_id ON inspection_photos(org_id);
CREATE INDEX idx_inspection_photos_inspection_id ON inspection_photos(inspection_id);

-- Treatments
CREATE TABLE treatments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    inspection_id UUID REFERENCES inspections(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL, -- e.g., 'varroa', 'nosema', 'antimicrobial'
    product VARCHAR(255) NOT NULL,
    batch VARCHAR(100),
    dose VARCHAR(255),
    method VARCHAR(255),
    withdrawal_end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_treatments_org_id ON treatments(org_id);
CREATE INDEX idx_treatments_inspection_id ON treatments(inspection_id);

-- Maintenance Checks
CREATE TABLE maintenance_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    inspection_id UUID REFERENCES inspections(id) ON DELETE CASCADE,
    hive_id UUID NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    condition_fields JSONB, -- Flexible structure for various checks
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_maintenance_checks_org_id ON maintenance_checks(org_id);
CREATE INDEX idx_maintenance_checks_inspection_id ON maintenance_checks(inspection_id);
CREATE INDEX idx_maintenance_checks_hive_id ON maintenance_checks(hive_id);

-- Tasks/Actions
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    hive_id UUID REFERENCES hives(id) ON DELETE CASCADE,
    inspection_id UUID REFERENCES inspections(id) ON DELETE SET NULL,
    type VARCHAR(100) NOT NULL, -- e.g., 'inspection_due', 'treatment_due', 'maintenance'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE NOT NULL,
    assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_tasks_org_id ON tasks(org_id);
CREATE INDEX idx_tasks_hive_id ON tasks(hive_id);
CREATE INDEX idx_tasks_assigned_user_id ON tasks(assigned_user_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_status ON tasks(status);

-- Activity Log
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- e.g., 'login', 'create_inspection', 'upload_photo', 'admin_create_user'
    entity_type VARCHAR(50), -- e.g., 'inspection', 'hive', 'user'
    entity_id UUID,
    metadata_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_activity_log_org_id ON activity_log(org_id);
CREATE INDEX idx_activity_log_actor_user_id ON activity_log(actor_user_id);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);

-- Inspection Amendments (for audit trail when corrections are needed)
CREATE TABLE inspection_amendments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reason TEXT NOT NULL,
    patch_json JSONB, -- What was changed/addended
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_inspection_amendments_org_id ON inspection_amendments(org_id);
CREATE INDEX idx_inspection_amendments_inspection_id ON inspection_amendments(inspection_id);

-- Sync Queue (for offline sync management - client-side, but tracking on server)
CREATE TABLE sync_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    client_uuid UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'create', 'update'
    payload_json JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'syncing', 'synced', 'failed')),
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    synced_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_sync_queue_org_id ON sync_queue(org_id);
CREATE INDEX idx_sync_queue_user_id ON sync_queue(user_id);
CREATE INDEX idx_sync_queue_status ON sync_queue(status);
CREATE INDEX idx_sync_queue_client_uuid ON sync_queue(client_uuid);
