-- Queen Grafting Sessions Migration
-- Adds support for tracking queen grafting sessions with checklists and countdown timers

CREATE TABLE IF NOT EXISTS queen_grafting_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    queen_id UUID REFERENCES queen_records(id) ON DELETE SET NULL,
    hive_id UUID REFERENCES hives(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    grafting_date DATE NOT NULL,
    method VARCHAR(50) DEFAULT 'standard' CHECK (method IN ('standard', 'starter_finisher', 'cell_builder')),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    checklist_completed JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_queen_grafting_sessions_org_id ON queen_grafting_sessions(org_id);
CREATE INDEX idx_queen_grafting_sessions_queen_id ON queen_grafting_sessions(queen_id);
CREATE INDEX idx_queen_grafting_sessions_hive_id ON queen_grafting_sessions(hive_id);
CREATE INDEX idx_queen_grafting_sessions_status ON queen_grafting_sessions(status);
CREATE INDEX idx_queen_grafting_sessions_grafting_date ON queen_grafting_sessions(grafting_date);
