-- IoT devices registered per org and optionally assigned to a hive

CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    device_name TEXT,
    hive_id UUID REFERENCES hives(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, device_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_hive_id ON devices(hive_id) WHERE hive_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_devices_org_id ON devices(org_id);
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
