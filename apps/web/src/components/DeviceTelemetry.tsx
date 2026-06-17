import { useEffect, useMemo, useState } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { HiveTelemetry, TelemetryReading } from '@my-hive/shared';
import { api } from '../utils/api';
import './DeviceTelemetry.css';

interface DeviceTelemetryProps {
    hiveId: string;
}

function formatTime(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatRelative(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

function chartDataFromHistory(history: TelemetryReading[]) {
    return history.map((point) => ({
        time: formatTime(point.received_at),
        received_at: point.received_at,
        internal: point.sensors?.internal_temp_c ?? null,
        external: point.sensors?.external_temp_c ?? null,
        cpu: point.sensors?.cpu_temp_c ?? null,
    }));
}

export default function DeviceTelemetry({ hiveId }: DeviceTelemetryProps) {
    const [telemetry, setTelemetry] = useState<HiveTelemetry | null>(null);
    const [loading, setLoading] = useState(true);
    const [noDevice, setNoDevice] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadTelemetry = async () => {
        try {
            setLoading(true);
            setError(null);
            setNoDevice(false);
            const res = await api.get(`/hives/${hiveId}/telemetry`);
            setTelemetry(res.data);
        } catch (err: any) {
            if (err.response?.status === 404) {
                setNoDevice(true);
                setTelemetry(null);
            } else {
                setError('Failed to load device telemetry');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (hiveId) {
            loadTelemetry();
        }
    }, [hiveId]);

    const chartData = useMemo(
        () => (telemetry?.history ? chartDataFromHistory(telemetry.history) : []),
        [telemetry]
    );

    const hasInternal = chartData.some((d) => d.internal != null);
    const hasExternal = chartData.some((d) => d.external != null);
    const hasCpu = chartData.some((d) => d.cpu != null);

    if (loading) {
        return <div className="device-telemetry-loading">Loading sensor data...</div>;
    }

    if (noDevice) {
        return (
            <div className="device-telemetry-empty">
                <p>No device linked to this hive.</p>
                <p className="device-telemetry-hint">Ask an admin to register and assign an IoT node in the Admin panel.</p>
            </div>
        );
    }

    if (error || !telemetry) {
        return (
            <div className="device-telemetry-error">
                {error || 'Telemetry unavailable'}
                <button type="button" className="btn-secondary btn-sm" onClick={loadTelemetry}>
                    Retry
                </button>
            </div>
        );
    }

    const { device, latest } = telemetry;
    const sensors = latest?.sensors;
    const bees = latest?.bees;
    const status = latest?.status ?? 'unknown';

    return (
        <div className="device-telemetry">
            <div className="device-telemetry-header">
                <div>
                    <div className="device-telemetry-title">
                        {device.device_name || device.device_id}
                    </div>
                    <div className="device-telemetry-meta">
                        ID: {device.device_id}
                        {latest?.received_at && (
                            <> · Last seen {formatRelative(latest.received_at)}</>
                        )}
                    </div>
                </div>
                <span className={`device-status-badge status-${status}`}>{status}</span>
            </div>

            <div className="device-telemetry-grid">
                <div className="device-metric-card">
                    <span className="device-metric-label">Internal</span>
                    <span className="device-metric-value">
                        {sensors?.internal_temp_c != null ? `${sensors.internal_temp_c}°C` : '—'}
                    </span>
                </div>
                <div className="device-metric-card">
                    <span className="device-metric-label">External</span>
                    <span className="device-metric-value">
                        {sensors?.external_temp_c != null ? `${sensors.external_temp_c}°C` : '—'}
                    </span>
                </div>
                <div className="device-metric-card">
                    <span className="device-metric-label">Pi CPU</span>
                    <span className="device-metric-value">
                        {sensors?.cpu_temp_c != null ? `${sensors.cpu_temp_c}°C` : '—'}
                    </span>
                </div>
            </div>

            {bees && (bees.in_count != null || bees.out_count != null) && (
                <div className="device-bees-summary">
                    Bees (last window): {bees.in_count ?? 0} in / {bees.out_count ?? 0} out
                </div>
            )}

            {chartData.length > 0 && (hasInternal || hasExternal || hasCpu) ? (
                <div className="device-telemetry-chart">
                    <h4>Temperature (7 days)</h4>
                    <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                            <YAxis unit="°C" tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Legend />
                            {hasInternal && (
                                <Line type="monotone" dataKey="internal" name="Internal" stroke="#e65100" dot={false} connectNulls />
                            )}
                            {hasExternal && (
                                <Line type="monotone" dataKey="external" name="External" stroke="#1565c0" dot={false} connectNulls />
                            )}
                            {hasCpu && (
                                <Line type="monotone" dataKey="cpu" name="Pi CPU" stroke="#6a1b9a" dot={false} connectNulls />
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <p className="device-telemetry-hint">No temperature history yet. Data appears after heartbeats are received.</p>
            )}
        </div>
    );
}
