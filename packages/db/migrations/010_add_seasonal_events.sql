-- Seasonal Events Migration
-- Adds support for tracking seasonal beekeeping events like nectar flows, bloom periods, etc.

-- Seasonal Event Templates (global templates that organizations can use)
CREATE TABLE IF NOT EXISTS seasonal_event_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('nectar_flow', 'bloom_period', 'swarm_season', 'winter_prep', 'spring_buildup', 'dearth_period', 'harvest_season', 'other')),
    description TEXT,
    default_start_month INTEGER CHECK (default_start_month >= 1 AND default_start_month <= 12),
    default_start_day INTEGER CHECK (default_start_day >= 1 AND default_start_day <= 31),
    default_end_month INTEGER CHECK (default_end_month >= 1 AND default_end_month <= 12),
    default_end_day INTEGER CHECK (default_end_day >= 1 AND default_end_day <= 31),
    default_duration_days INTEGER, -- Alternative to end date
    region VARCHAR(100), -- 'northern_hemisphere', 'southern_hemisphere', 'temperate', 'tropical', etc.
    color VARCHAR(7) DEFAULT '#10b981', -- Hex color for calendar display
    is_global BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_seasonal_event_templates_event_type ON seasonal_event_templates(event_type);
CREATE INDEX idx_seasonal_event_templates_region ON seasonal_event_templates(region);
CREATE INDEX idx_seasonal_event_templates_is_global ON seasonal_event_templates(is_global);

-- Seasonal Events (organization-specific instances)
CREATE TABLE IF NOT EXISTS seasonal_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    template_id UUID REFERENCES seasonal_event_templates(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('nectar_flow', 'bloom_period', 'swarm_season', 'winter_prep', 'spring_buildup', 'dearth_period', 'harvest_season', 'other')),
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    recurring BOOLEAN DEFAULT false,
    recurring_start_month INTEGER CHECK (recurring_start_month IS NULL OR (recurring_start_month >= 1 AND recurring_start_month <= 12)),
    recurring_start_day INTEGER CHECK (recurring_start_day IS NULL OR (recurring_start_day >= 1 AND recurring_start_day <= 31)),
    recurring_duration_days INTEGER, -- How long the event lasts if recurring
    apiary_id UUID REFERENCES apiaries(id) ON DELETE SET NULL,
    notes TEXT,
    color VARCHAR(7) DEFAULT '#10b981',
    created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_seasonal_events_org_id ON seasonal_events(org_id);
CREATE INDEX idx_seasonal_events_template_id ON seasonal_events(template_id);
CREATE INDEX idx_seasonal_events_event_type ON seasonal_events(event_type);
CREATE INDEX idx_seasonal_events_start_date ON seasonal_events(start_date);
CREATE INDEX idx_seasonal_events_end_date ON seasonal_events(end_date);
CREATE INDEX idx_seasonal_events_apiary_id ON seasonal_events(apiary_id);
CREATE INDEX idx_seasonal_events_recurring ON seasonal_events(recurring);

-- Insert global seasonal event templates
INSERT INTO seasonal_event_templates (name, event_type, description, default_start_month, default_start_day, default_end_month, default_end_day, region, color) VALUES
('Spring Nectar Flow', 'nectar_flow', 'Primary spring nectar flow period when major nectar sources are blooming. Time for colony expansion and honey production.', 3, 15, 5, 15, 'northern_hemisphere', '#10b981'),
('Summer Nectar Flow', 'nectar_flow', 'Main summer nectar flow. Peak honey production season. Monitor hive strength and add supers as needed.', 6, 1, 8, 31, 'northern_hemisphere', '#10b981'),
('Fall Nectar Flow', 'nectar_flow', 'Late season nectar flow. Important for winter stores. Prepare hives for winter during this period.', 9, 1, 11, 15, 'northern_hemisphere', '#10b981'),
('Swarm Season', 'swarm_season', 'Peak swarming period. Monitor hives closely for swarm cells. Time for splits and swarm prevention.', 4, 1, 6, 30, 'northern_hemisphere', '#f59e0b'),
('Winter Preparation', 'winter_prep', 'Critical period for preparing hives for winter. Ensure adequate stores, reduce entrances, install mouse guards.', 10, 1, 11, 30, 'northern_hemisphere', '#3b82f6'),
('Spring Buildup', 'spring_buildup', 'Early spring period for building up colony strength. Feed if needed, check stores, prepare for nectar flow.', 2, 1, 4, 15, 'northern_hemisphere', '#8b5cf6'),
('Summer Dearth', 'dearth_period', 'Period of low nectar availability. Monitor stores, may need to feed. Watch for robbing behavior.', 7, 15, 8, 15, 'northern_hemisphere', '#ef4444'),
('Main Harvest Season', 'harvest_season', 'Primary honey harvest period. Extract honey, process, and store. Leave adequate stores for bees.', 7, 1, 9, 30, 'northern_hemisphere', '#eab308')
ON CONFLICT DO NOTHING;

-- Southern Hemisphere variants
INSERT INTO seasonal_event_templates (name, event_type, description, default_start_month, default_start_day, default_end_month, default_end_day, region, color) VALUES
('Spring Nectar Flow (Southern)', 'nectar_flow', 'Primary spring nectar flow period when major nectar sources are blooming. Time for colony expansion and honey production.', 9, 15, 11, 15, 'southern_hemisphere', '#10b981'),
('Summer Nectar Flow (Southern)', 'nectar_flow', 'Main summer nectar flow. Peak honey production season. Monitor hive strength and add supers as needed.', 12, 1, 2, 28, 'southern_hemisphere', '#10b981'),
('Fall Nectar Flow (Southern)', 'nectar_flow', 'Late season nectar flow. Important for winter stores. Prepare hives for winter during this period.', 3, 1, 5, 15, 'southern_hemisphere', '#10b981'),
('Swarm Season (Southern)', 'swarm_season', 'Peak swarming period. Monitor hives closely for swarm cells. Time for splits and swarm prevention.', 10, 1, 12, 31, 'southern_hemisphere', '#f59e0b'),
('Winter Preparation (Southern)', 'winter_prep', 'Critical period for preparing hives for winter. Ensure adequate stores, reduce entrances, install mouse guards.', 4, 1, 5, 31, 'southern_hemisphere', '#3b82f6'),
('Spring Buildup (Southern)', 'spring_buildup', 'Early spring period for building up colony strength. Feed if needed, check stores, prepare for nectar flow.', 8, 1, 10, 15, 'southern_hemisphere', '#8b5cf6'),
('Summer Dearth (Southern)', 'dearth_period', 'Period of low nectar availability. Monitor stores, may need to feed. Watch for robbing behavior.', 1, 15, 2, 15, 'southern_hemisphere', '#ef4444'),
('Main Harvest Season (Southern)', 'harvest_season', 'Primary honey harvest period. Extract honey, process, and store. Leave adequate stores for bees.', 1, 1, 3, 31, 'southern_hemisphere', '#eab308')
ON CONFLICT DO NOTHING;
