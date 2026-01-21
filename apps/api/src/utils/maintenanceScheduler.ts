import cron from 'node-cron';
import { pool } from '../db.js';

export async function generateMaintenanceTasks() {
    try {
        console.log('[Maintenance Scheduler] Starting task generation...');

        // Get all active schedules where next_due_date <= today
        const schedulesResult = await pool.query(
            `SELECT ms.*, mt.name as template_name, mt.task_type, mt.instructions
             FROM maintenance_schedules ms
             LEFT JOIN maintenance_templates mt ON ms.template_id = mt.id
             WHERE ms.is_active = true
               AND ms.next_due_date <= CURRENT_DATE
             ORDER BY ms.next_due_date`
        );

        const schedules = schedulesResult.rows;
        console.log(`[Maintenance Scheduler] Found ${schedules.length} schedules due for task generation`);

        let tasksCreated = 0;

        for (const schedule of schedules) {
            try {
                // Check if task already exists for this schedule and due date
                const existingTaskResult = await pool.query(
                    `SELECT id FROM tasks
                     WHERE recurring_schedule_id = $1
                       AND due_date = $2
                       AND status != 'completed'`,
                    [schedule.id, schedule.next_due_date]
                );

                if (existingTaskResult.rows.length > 0) {
                    console.log(`[Maintenance Scheduler] Task already exists for schedule ${schedule.id} on ${schedule.next_due_date}`);
                    continue;
                }

                // Get org_id from schedule
                const orgResult = await pool.query(
                    `SELECT org_id FROM maintenance_schedules WHERE id = $1`,
                    [schedule.id]
                );

                if (orgResult.rows.length === 0) {
                    console.log(`[Maintenance Scheduler] Schedule ${schedule.id} not found, skipping`);
                    continue;
                }

                const orgId = orgResult.rows[0].org_id;

                // Create task
                if (schedule.template_id && schedule.template_name) {
                    // Use template data
                    await pool.query(
                        `INSERT INTO tasks (org_id, hive_id, type, title, description, due_date, template_id, recurring_schedule_id, status)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                        [
                            orgId,
                            schedule.hive_id,
                            schedule.task_type || 'maintenance',
                            schedule.template_name,
                            schedule.instructions || null,
                            schedule.next_due_date,
                            schedule.template_id,
                            schedule.id,
                            'pending'
                        ]
                    );
                } else {
                    // Create basic task from schedule name
                    await pool.query(
                        `INSERT INTO tasks (org_id, hive_id, type, title, description, due_date, recurring_schedule_id, status)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [
                            orgId,
                            schedule.hive_id,
                            'maintenance',
                            schedule.name,
                            null,
                            schedule.next_due_date,
                            schedule.id,
                            'pending'
                        ]
                    );
                }

                tasksCreated++;
                console.log(`[Maintenance Scheduler] Created task for schedule ${schedule.id} (${schedule.name})`);
            } catch (error) {
                console.error(`[Maintenance Scheduler] Error processing schedule ${schedule.id}:`, error);
                // Continue with next schedule
            }
        }

        console.log(`[Maintenance Scheduler] Task generation complete. Created ${tasksCreated} tasks.`);
    } catch (error) {
        console.error('[Maintenance Scheduler] Error generating tasks:', error);
    }
}

export function startMaintenanceScheduler() {
    // Schedule to run daily at 2 AM
    // For development, you can use a shorter interval like '*/5 * * * *' (every 5 minutes)
    const cronExpression = process.env.NODE_ENV === 'production' 
        ? '0 2 * * *'  // 2 AM daily
        : '*/30 * * * *';  // Every 30 minutes in development

    console.log(`[Maintenance Scheduler] Starting scheduler with cron: ${cronExpression}`);

    cron.schedule(cronExpression, async () => {
        await generateMaintenanceTasks();
    });

    // Also run immediately on startup (optional, for testing)
    if (process.env.NODE_ENV !== 'production') {
        console.log('[Maintenance Scheduler] Running initial task generation...');
        generateMaintenanceTasks();
    }
}
