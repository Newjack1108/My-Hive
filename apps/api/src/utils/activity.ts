import { pool } from '../db.js';

export async function logActivity(
    orgId: string | null,
    actorUserId: string | null,
    action: string,
    entityType: string | null,
    entityId: string | null,
    metadata: Record<string, any>
) {
    try {
        await pool.query(
            `INSERT INTO activity_log (org_id, actor_user_id, action, entity_type, entity_id, metadata_json)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [orgId, actorUserId, action, entityType, entityId, JSON.stringify(metadata)]
        );
    } catch (error) {
        // Don't fail the main operation if logging fails
        console.error('Failed to log activity:', error);
    }
}
