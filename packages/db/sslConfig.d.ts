export function getDbSslConfig(
    connectionString: string | undefined
): { rejectUnauthorized: boolean } | undefined;
