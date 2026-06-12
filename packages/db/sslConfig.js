/**
 * SSL config for node-pg connections.
 * Railway private URLs (postgres.railway.internal) do not use SSL.
 * Public proxy URLs (*.proxy.rlwy.net) require SSL.
 */
export function getDbSslConfig(connectionString) {
    if (!connectionString) {
        return undefined;
    }

    if (/localhost|127\.0\.0\.1/.test(connectionString)) {
        return undefined;
    }

    if (/railway\.internal/i.test(connectionString)) {
        return undefined;
    }

    if (/sslmode=disable/i.test(connectionString)) {
        return undefined;
    }

    if (/sslmode=(require|verify-full|verify-ca|prefer)/i.test(connectionString)) {
        return { rejectUnauthorized: false };
    }

    if (/\.proxy\.rlwy\.net/i.test(connectionString)) {
        return { rejectUnauthorized: false };
    }

    if (process.env.NODE_ENV === 'production') {
        return { rejectUnauthorized: false };
    }

    return undefined;
}
