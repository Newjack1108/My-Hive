-- Update device_heartbeats schema: SERIAL id, device_timestamp, status NOT NULL

DROP TABLE IF EXISTS device_heartbeats;

CREATE TABLE IF NOT EXISTS device_heartbeats (
  id SERIAL PRIMARY KEY,
  device_id TEXT NOT NULL,
  device_name TEXT,
  status TEXT NOT NULL,
  device_timestamp TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB
);

CREATE INDEX idx_device_heartbeats_device_id ON device_heartbeats(device_id);
CREATE INDEX idx_device_heartbeats_received_at ON device_heartbeats(received_at DESC);
CREATE INDEX idx_device_heartbeats_device_id_received_at ON device_heartbeats(device_id, received_at DESC);
