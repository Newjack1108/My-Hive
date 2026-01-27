import express from 'express';
import { pool } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

export const calendarRouter = express.Router();

calendarRouter.use(authenticateToken);

interface CalendarEvent {
    id: string;
    type: string;
    date: string;
    title: string;
    description?: string;
    hive_id?: string;
    hive_label?: string;
    entity_id?: string;
    color?: string;
}

// Get calendar events for a date range
calendarRouter.get('/events', async (req: AuthRequest, res, next) => {
    try {
        const { start_date, end_date, types } = req.query;
        
        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'start_date and end_date are required' });
        }

        const eventTypes = types ? (Array.isArray(types) ? types : [types]) : null;
        const events: CalendarEvent[] = [];

        // Inspections
        if (!eventTypes || eventTypes.includes('inspection')) {
            const inspectionsResult = await pool.query(
                `SELECT i.id, i.started_at::date as date, i.hive_id, h.label as hive_label,
                        CONCAT('Inspection - ', h.label) as title,
                        i.notes as description
                 FROM inspections i
                 JOIN hives h ON i.hive_id = h.id
                 WHERE i.org_id = $1 
                   AND i.started_at::date >= $2 
                   AND i.started_at::date <= $3
                 ORDER BY i.started_at`,
                [req.user!.org_id, start_date, end_date]
            );

            inspectionsResult.rows.forEach((row: any) => {
                events.push({
                    id: row.id,
                    type: 'inspection',
                    date: row.date,
                    title: row.title,
                    description: row.description,
                    hive_id: row.hive_id,
                    hive_label: row.hive_label,
                    entity_id: row.id,
                    color: '#3b82f6' // blue
                });
            });
        }

        // Tasks
        if (!eventTypes || eventTypes.includes('task')) {
            const tasksResult = await pool.query(
                `SELECT t.id, t.due_date as date, t.hive_id, h.label as hive_label,
                        t.title, t.description, t.status
                 FROM tasks t
                 LEFT JOIN hives h ON t.hive_id = h.id
                 WHERE t.org_id = $1 
                   AND t.due_date >= $2 
                   AND t.due_date <= $3
                 ORDER BY t.due_date`,
                [req.user!.org_id, start_date, end_date]
            );

            tasksResult.rows.forEach((row: any) => {
                events.push({
                    id: row.id,
                    type: 'task',
                    date: row.date,
                    title: row.title,
                    description: row.description,
                    hive_id: row.hive_id,
                    hive_label: row.hive_label,
                    entity_id: row.id,
                    color: row.status === 'completed' ? '#10b981' : row.status === 'in_progress' ? '#f59e0b' : '#ef4444' // green, amber, red
                });
            });
        }

        // Maintenance Due
        if (!eventTypes || eventTypes.includes('maintenance_due')) {
            const maintenanceDueResult = await pool.query(
                `SELECT ms.id, ms.next_due_date as date, ms.hive_id, h.label as hive_label,
                        ms.name as title, mt.instructions as description
                 FROM maintenance_schedules ms
                 LEFT JOIN hives h ON ms.hive_id = h.id
                 LEFT JOIN maintenance_templates mt ON ms.template_id = mt.id
                 WHERE ms.org_id = $1 
                   AND ms.is_active = true
                   AND ms.next_due_date >= $2 
                   AND ms.next_due_date <= $3
                 ORDER BY ms.next_due_date`,
                [req.user!.org_id, start_date, end_date]
            );

            maintenanceDueResult.rows.forEach((row: any) => {
                events.push({
                    id: row.id,
                    type: 'maintenance_due',
                    date: row.date,
                    title: `Maintenance: ${row.title}`,
                    description: row.description,
                    hive_id: row.hive_id,
                    hive_label: row.hive_label,
                    entity_id: row.id,
                    color: '#8b5cf6' // purple
                });
            });
        }

        // Maintenance Completed
        if (!eventTypes || eventTypes.includes('maintenance_completed')) {
            const maintenanceCompletedResult = await pool.query(
                `SELECT mh.id, mh.completed_date as date, mh.hive_id, h.label as hive_label,
                        CONCAT('Completed: ', COALESCE(ms.name, 'Maintenance')) as title,
                        mh.notes as description
                 FROM maintenance_history mh
                 LEFT JOIN hives h ON mh.hive_id = h.id
                 LEFT JOIN maintenance_schedules ms ON mh.schedule_id = ms.id
                 WHERE mh.org_id = $1 
                   AND mh.completed_date >= $2 
                   AND mh.completed_date <= $3
                 ORDER BY mh.completed_date`,
                [req.user!.org_id, start_date, end_date]
            );

            maintenanceCompletedResult.rows.forEach((row: any) => {
                events.push({
                    id: row.id,
                    type: 'maintenance_completed',
                    date: row.date,
                    title: row.title,
                    description: row.description,
                    hive_id: row.hive_id,
                    hive_label: row.hive_label,
                    entity_id: row.id,
                    color: '#10b981' // green
                });
            });
        }

        // Hive Splits
        if (!eventTypes || eventTypes.includes('split')) {
            const splitsResult = await pool.query(
                `SELECT hs.id, hs.split_date as date, hs.parent_hive_id as hive_id, h.label as hive_label,
                        CONCAT('Split: ', h.label) as title,
                        hs.notes as description
                 FROM hive_splits hs
                 JOIN hives h ON hs.parent_hive_id = h.id
                 WHERE hs.org_id = $1 
                   AND hs.split_date >= $2 
                   AND hs.split_date <= $3
                 ORDER BY hs.split_date`,
                [req.user!.org_id, start_date, end_date]
            );

            splitsResult.rows.forEach((row: any) => {
                events.push({
                    id: row.id,
                    type: 'split',
                    date: row.date,
                    title: row.title,
                    description: row.description,
                    hive_id: row.hive_id,
                    hive_label: row.hive_label,
                    entity_id: row.id,
                    color: '#f97316' // orange
                });
            });
        }

        // Honey Harvests
        if (!eventTypes || eventTypes.includes('harvest')) {
            const harvestsResult = await pool.query(
                `SELECT hh.id, hh.harvest_date as date, hh.hive_id, h.label as hive_label,
                        CONCAT('Harvest: ', h.label, ' - ', hh.weight_kg, 'kg') as title,
                        hh.notes as description
                 FROM honey_harvests hh
                 JOIN hives h ON hh.hive_id = h.id
                 WHERE hh.org_id = $1 
                   AND hh.harvest_date >= $2 
                   AND hh.harvest_date <= $3
                 ORDER BY hh.harvest_date`,
                [req.user!.org_id, start_date, end_date]
            );

            harvestsResult.rows.forEach((row: any) => {
                events.push({
                    id: row.id,
                    type: 'harvest',
                    date: row.date,
                    title: row.title,
                    description: row.description,
                    hive_id: row.hive_id,
                    hive_label: row.hive_label,
                    entity_id: row.id,
                    color: '#eab308' // yellow
                });
            });
        }

        // Treatments
        if (!eventTypes || eventTypes.includes('treatment')) {
            const treatmentsResult = await pool.query(
                `SELECT t.id, t.created_at::date as date, i.hive_id, h.label as hive_label,
                        CONCAT('Treatment: ', t.type, ' - ', t.product) as title,
                        CONCAT('Method: ', COALESCE(t.method, 'N/A'), 
                               CASE WHEN t.withdrawal_end_date IS NOT NULL 
                                    THEN CONCAT(' | Withdrawal: ', t.withdrawal_end_date)
                                    ELSE '' END) as description
                 FROM treatments t
                 LEFT JOIN inspections i ON t.inspection_id = i.id
                 LEFT JOIN hives h ON i.hive_id = h.id
                 WHERE t.org_id = $1 
                   AND t.created_at::date >= $2 
                   AND t.created_at::date <= $3
                 ORDER BY t.created_at`,
                [req.user!.org_id, start_date, end_date]
            );

            treatmentsResult.rows.forEach((row: any) => {
                events.push({
                    id: row.id,
                    type: 'treatment',
                    date: row.date,
                    title: row.title,
                    description: row.description,
                    hive_id: row.hive_id,
                    hive_label: row.hive_label,
                    entity_id: row.id,
                    color: '#06b6d4' // cyan
                });
            });
        }

        // Pest Occurrences
        if (!eventTypes || eventTypes.includes('pest_occurrence')) {
            const pestsResult = await pool.query(
                `SELECT po.id, po.occurrence_date as date, po.hive_id, h.label as hive_label,
                        CONCAT('Pest: ', pk.name) as title,
                        po.notes as description
                 FROM pest_occurrences po
                 JOIN hives h ON po.hive_id = h.id
                 JOIN pest_knowledge_base pk ON po.pest_id = pk.id
                 WHERE po.org_id = $1 
                   AND po.occurrence_date >= $2 
                   AND po.occurrence_date <= $3
                 ORDER BY po.occurrence_date`,
                [req.user!.org_id, start_date, end_date]
            );

            pestsResult.rows.forEach((row: any) => {
                events.push({
                    id: row.id,
                    type: 'pest_occurrence',
                    date: row.date,
                    title: row.title,
                    description: row.description,
                    hive_id: row.hive_id,
                    hive_label: row.hive_label,
                    entity_id: row.id,
                    color: '#dc2626' // red
                });
            });
        }

        // Seasonal Events
        if (!eventTypes || eventTypes.includes('seasonal_event')) {
            const seasonalResult = await pool.query(
                `SELECT se.id, se.start_date as date, se.end_date, se.name as title,
                        se.description, se.event_type, se.color, se.apiary_id,
                        a.name as apiary_name
                 FROM seasonal_events se
                 LEFT JOIN apiaries a ON se.apiary_id = a.id
                 WHERE se.org_id = $1 
                   AND se.start_date <= $3
                   AND (se.end_date >= $2 OR se.end_date IS NULL)
                 ORDER BY se.start_date`,
                [req.user!.org_id, start_date, end_date]
            );

            seasonalResult.rows.forEach((row: any) => {
                // Create events for each day in the range
                const eventStart = new Date(row.date);
                const eventEnd = row.end_date ? new Date(row.end_date) : eventStart;
                const currentDate = new Date(eventStart);
                
                while (currentDate <= eventEnd) {
                    const dateStr = currentDate.toISOString().split('T')[0];
                    // Only add if within requested range
                    if (dateStr >= start_date && dateStr <= end_date) {
                        events.push({
                            id: `${row.id}-${dateStr}`,
                            type: 'seasonal_event',
                            date: dateStr,
                            title: row.title,
                            description: row.description || `${row.event_type.replace('_', ' ')}`,
                            hive_id: undefined,
                            hive_label: row.apiary_name || undefined,
                            entity_id: row.id,
                            color: row.color || '#10b981'
                        });
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            });
        }

        // Sort events by date
        events.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateA.getTime() - dateB.getTime();
        });

        res.json({ events });
    } catch (error) {
        next(error);
    }
});

// Get events for a specific month
calendarRouter.get('/month/:year/:month', async (req: AuthRequest, res, next) => {
    try {
        const year = parseInt(req.params.year);
        const month = parseInt(req.params.month);
        
        if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
            return res.status(400).json({ error: 'Invalid year or month' });
        }

        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        // Call events endpoint logic
        const types = req.query.types ? (Array.isArray(req.query.types) ? req.query.types : [req.query.types]) : null;
        const events: CalendarEvent[] = [];

        // Reuse the events logic from the main endpoint
        // (In a real implementation, you'd extract this to a shared function)
        // For now, redirect to the events endpoint
        return res.redirect(`/api/calendar/events?start_date=${startDate}&end_date=${endDate}${types ? `&types=${types.join('&types=')}` : ''}`);
    } catch (error) {
        next(error);
    }
});

// Get events for a specific day
calendarRouter.get('/day/:date', async (req: AuthRequest, res, next) => {
    try {
        const date = req.params.date;
        
        // Validate date format (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
        }

        const types = req.query.types ? (Array.isArray(req.query.types) ? req.query.types : [req.query.types]) : null;
        return res.redirect(`/api/calendar/events?start_date=${date}&end_date=${date}${types ? `&types=${types.join('&types=')}` : ''}`);
    } catch (error) {
        next(error);
    }
});
