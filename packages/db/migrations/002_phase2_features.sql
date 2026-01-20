-- Phase 2 Features Migration
-- Enable PostGIS extension for spatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add feeding_radius_m to apiaries table
ALTER TABLE apiaries ADD COLUMN IF NOT EXISTS feeding_radius_m DECIMAL(10, 2);

-- Create spatial index for apiaries (if lat/lng exist)
CREATE INDEX IF NOT EXISTS idx_apiaries_location ON apiaries USING GIST (
    ST_MakePoint(lng, lat)
) WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Queen Records
CREATE TABLE IF NOT EXISTS queen_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    hive_id UUID REFERENCES hives(id) ON DELETE SET NULL,
    name VARCHAR(255),
    lineage VARCHAR(255),
    birth_date DATE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'replaced', 'dead', 'unknown')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_queen_records_org_id ON queen_records(org_id);
CREATE INDEX idx_queen_records_hive_id ON queen_records(hive_id);

-- Breeding Plans
CREATE TABLE IF NOT EXISTS breeding_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    target_traits JSONB,
    timeline_start DATE,
    timeline_end DATE,
    status VARCHAR(50) DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_breeding_plans_org_id ON breeding_plans(org_id);

-- Queen Lineage
CREATE TABLE IF NOT EXISTS queen_lineage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    queen_id UUID NOT NULL REFERENCES queen_records(id) ON DELETE CASCADE,
    parent_queen_id UUID REFERENCES queen_records(id) ON DELETE SET NULL,
    parent_drone_source VARCHAR(255),
    generation INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_queen_lineage_org_id ON queen_lineage(org_id);
CREATE INDEX idx_queen_lineage_queen_id ON queen_lineage(queen_id);
CREATE INDEX idx_queen_lineage_parent_queen_id ON queen_lineage(parent_queen_id);

-- Breeding Matches
CREATE TABLE IF NOT EXISTS breeding_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    breeding_plan_id UUID NOT NULL REFERENCES breeding_plans(id) ON DELETE CASCADE,
    queen_id UUID NOT NULL REFERENCES queen_records(id) ON DELETE CASCADE,
    drone_source VARCHAR(255),
    planned_date DATE,
    status VARCHAR(50) DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_breeding_matches_org_id ON breeding_matches(org_id);
CREATE INDEX idx_breeding_matches_breeding_plan_id ON breeding_matches(breeding_plan_id);
CREATE INDEX idx_breeding_matches_queen_id ON breeding_matches(queen_id);

-- Product Categories
CREATE TABLE IF NOT EXISTS product_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_product_categories_org_id ON product_categories(org_id);

-- Products
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    sku VARCHAR(100),
    image_url VARCHAR(500),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_products_org_id ON products(org_id);
CREATE INDEX idx_products_category_id ON products(category_id);

-- Cart Items
CREATE TABLE IF NOT EXISTS cart_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

CREATE INDEX idx_cart_items_org_id ON cart_items(org_id);
CREATE INDEX idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX idx_cart_items_product_id ON cart_items(product_id);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
    shipping_address TEXT,
    payment_method VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_orders_org_id ON orders(org_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_order_items_org_id ON order_items(org_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- Inventory
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity_change INTEGER NOT NULL,
    movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN ('purchase', 'sale', 'adjustment', 'return')),
    reference_id UUID,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_inventory_org_id ON inventory(org_id);
CREATE INDEX idx_inventory_product_id ON inventory(product_id);

-- Honey Harvests
CREATE TABLE IF NOT EXISTS honey_harvests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    hive_id UUID NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    harvest_date DATE NOT NULL,
    weight_kg DECIMAL(10, 2) NOT NULL,
    frames INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_honey_harvests_org_id ON honey_harvests(org_id);
CREATE INDEX idx_honey_harvests_hive_id ON honey_harvests(hive_id);
CREATE INDEX idx_honey_harvests_harvest_date ON honey_harvests(harvest_date DESC);

-- Honey Storage
CREATE TABLE IF NOT EXISTS honey_storage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    location_name VARCHAR(255) NOT NULL,
    location_type VARCHAR(50) CHECK (location_type IN ('jar', 'bucket', 'barrel', 'other')),
    capacity_kg DECIMAL(10, 2),
    current_quantity_kg DECIMAL(10, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_honey_storage_org_id ON honey_storage(org_id);

-- Honey Batches
CREATE TABLE IF NOT EXISTS honey_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    harvest_id UUID REFERENCES honey_harvests(id) ON DELETE SET NULL,
    batch_number VARCHAR(100) NOT NULL,
    processing_date DATE,
    weight_kg DECIMAL(10, 2),
    quality_metrics JSONB,
    storage_location_id UUID REFERENCES honey_storage(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_honey_batches_org_id ON honey_batches(org_id);
CREATE INDEX idx_honey_batches_harvest_id ON honey_batches(harvest_id);
CREATE INDEX idx_honey_batches_batch_number ON honey_batches(batch_number);

-- Pest Knowledge Base
CREATE TABLE IF NOT EXISTS pest_knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organisations(id) ON DELETE CASCADE, -- NULL for global knowledge base
    name VARCHAR(255) NOT NULL,
    scientific_name VARCHAR(255),
    description TEXT,
    symptoms TEXT,
    treatment_options JSONB,
    prevention_methods TEXT,
    severity_level VARCHAR(50) CHECK (severity_level IN ('low', 'moderate', 'high', 'critical')),
    is_global BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pest_knowledge_base_org_id ON pest_knowledge_base(org_id);
CREATE INDEX idx_pest_knowledge_base_name ON pest_knowledge_base(name);

-- Pest Treatments
CREATE TABLE IF NOT EXISTS pest_treatments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organisations(id) ON DELETE CASCADE, -- NULL for global treatments
    pest_id UUID NOT NULL REFERENCES pest_knowledge_base(id) ON DELETE CASCADE,
    treatment_name VARCHAR(255) NOT NULL,
    treatment_method TEXT,
    products TEXT,
    application_instructions TEXT,
    effectiveness_rating INTEGER CHECK (effectiveness_rating >= 1 AND effectiveness_rating <= 5),
    is_global BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pest_treatments_org_id ON pest_treatments(org_id);
CREATE INDEX idx_pest_treatments_pest_id ON pest_treatments(pest_id);

-- Pest Occurrences
CREATE TABLE IF NOT EXISTS pest_occurrences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    hive_id UUID NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    pest_id UUID NOT NULL REFERENCES pest_knowledge_base(id) ON DELETE RESTRICT,
    inspection_id UUID REFERENCES inspections(id) ON DELETE SET NULL,
    occurrence_date DATE NOT NULL,
    severity VARCHAR(50) CHECK (severity IN ('low', 'moderate', 'high', 'critical')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pest_occurrences_org_id ON pest_occurrences(org_id);
CREATE INDEX idx_pest_occurrences_hive_id ON pest_occurrences(hive_id);
CREATE INDEX idx_pest_occurrences_pest_id ON pest_occurrences(pest_id);
CREATE INDEX idx_pest_occurrences_occurrence_date ON pest_occurrences(occurrence_date DESC);

-- Treatment Effectiveness
CREATE TABLE IF NOT EXISTS treatment_effectiveness (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    pest_occurrence_id UUID NOT NULL REFERENCES pest_occurrences(id) ON DELETE CASCADE,
    treatment_id UUID NOT NULL REFERENCES pest_treatments(id) ON DELETE RESTRICT,
    treatment_date DATE NOT NULL,
    effectiveness_rating INTEGER CHECK (effectiveness_rating >= 1 AND effectiveness_rating <= 5),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_treatment_effectiveness_org_id ON treatment_effectiveness(org_id);
CREATE INDEX idx_treatment_effectiveness_pest_occurrence_id ON treatment_effectiveness(pest_occurrence_id);
CREATE INDEX idx_treatment_effectiveness_treatment_id ON treatment_effectiveness(treatment_id);

-- Maintenance Templates
CREATE TABLE IF NOT EXISTS maintenance_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    task_type VARCHAR(100) NOT NULL,
    default_duration_days INTEGER,
    instructions TEXT,
    checklist_items JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_maintenance_templates_org_id ON maintenance_templates(org_id);

-- Maintenance Schedules
CREATE TABLE IF NOT EXISTS maintenance_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    template_id UUID REFERENCES maintenance_templates(id) ON DELETE SET NULL,
    hive_id UUID REFERENCES hives(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    frequency_type VARCHAR(50) NOT NULL CHECK (frequency_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom')),
    frequency_value INTEGER DEFAULT 1,
    next_due_date DATE NOT NULL,
    last_completed_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_maintenance_schedules_org_id ON maintenance_schedules(org_id);
CREATE INDEX idx_maintenance_schedules_template_id ON maintenance_schedules(template_id);
CREATE INDEX idx_maintenance_schedules_hive_id ON maintenance_schedules(hive_id);
CREATE INDEX idx_maintenance_schedules_next_due_date ON maintenance_schedules(next_due_date);

-- Maintenance History
CREATE TABLE IF NOT EXISTS maintenance_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES maintenance_schedules(id) ON DELETE SET NULL,
    hive_id UUID NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    completed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    completed_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_maintenance_history_org_id ON maintenance_history(org_id);
CREATE INDEX idx_maintenance_history_schedule_id ON maintenance_history(schedule_id);
CREATE INDEX idx_maintenance_history_hive_id ON maintenance_history(hive_id);
CREATE INDEX idx_maintenance_history_completed_date ON maintenance_history(completed_date DESC);

-- Enhance tasks table for Phase 2
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurring_schedule_id UUID REFERENCES maintenance_schedules(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES maintenance_templates(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

CREATE INDEX IF NOT EXISTS idx_tasks_recurring_schedule_id ON tasks(recurring_schedule_id);
CREATE INDEX IF NOT EXISTS idx_tasks_template_id ON tasks(template_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
