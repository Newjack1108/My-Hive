-- Device heartbeats from IoT devices (Pi, sensors, etc.)

CREATE TABLE IF NOT EXISTS device_heartbeats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    status VARCHAR(100),
    received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    payload JSONB
);

CREATE INDEX idx_device_heartbeats_device_id ON device_heartbeats(device_id);
CREATE INDEX idx_device_heartbeats_received_at ON device_heartbeats(received_at DESC);
CREATE INDEX idx_device_heartbeats_device_id_received_at ON device_heartbeats(device_id, received_at DESC);
