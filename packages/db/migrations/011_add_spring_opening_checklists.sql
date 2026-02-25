-- Spring Opening Checklists Migration
-- Adds built-in maintenance templates for Early Spring and Later Spring First Opening checklists.
-- Based on Karl Colyer 2026 beekeeping checklists.

-- Add is_builtin column to distinguish built-in templates
ALTER TABLE maintenance_templates ADD COLUMN IF NOT EXISTS is_builtin BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_maintenance_templates_is_builtin ON maintenance_templates(is_builtin);
CREATE INDEX IF NOT EXISTS idx_maintenance_templates_task_type ON maintenance_templates(task_type);

-- Insert Spring Opening templates for each existing organisation
DO $$
DECLARE
    org_record RECORD;
    early_spring_template_id UUID;
    later_spring_template_id UUID;
BEGIN
    FOR org_record IN SELECT id FROM organisations
    LOOP
        -- Check if templates already exist for this org (idempotency)
        IF NOT EXISTS (
            SELECT 1 FROM maintenance_templates
            WHERE org_id = org_record.id AND task_type = 'first_opening_early_spring'
        ) THEN
            INSERT INTO maintenance_templates (
                org_id, name, description, task_type, default_duration_days,
                instructions, checklist_items, is_builtin
            ) VALUES (
                org_record.id,
                'Early Spring First Opening',
                'Survival check (late Feb - March). Ask only: Alive? Queenright? Fed? Healthy?',
                'first_opening_early_spring',
                45,
                E'DON''T:\n• Don''t open in cold or wind\n• Don''t pull every frame\n• Don''t hunt for the queen\n• Don''t split colonies\n• Don''t remove food frames without replacing\n• Don''t add supers yet\n• Don''t break up brood nest\n• Don''t rotate brood frames\n• Don''t feed thin syrup in cold weather\n• Don''t panic about small brood\n• Don''t scrape everything clean\n• Don''t treat Varroa blindly\n• Don''t widen entrances on weak colonies\n• Don''t leave hive open while thinking\n• Don''t assume spring will be steady',
                '[
                    "Choose a mild, calm day (13–15°C, bees flying)",
                    "Watch the entrance first (pollen = brood likely)",
                    "Work quickly and gently",
                    "Check weight / stores first",
                    "Feed immediately if light",
                    "Look for brood (eggs or larvae)",
                    "Expect small brood area",
                    "Note if drone brood is present (usually unsealed at this stage)",
                    "Keep brood frames together and central",
                    "Remove obviously dead or mouldy frames",
                    "Clean blocked floors",
                    "Check for disease signs (chalkbrood, dysentery, smells)",
                    "Reduce entrance if colony is weak",
                    "Ensure ventilation not blocked",
                    "Scrape only what prevents frame movement",
                    "Tilt hive slightly forward",
                    "Unite hopelessly weak colonies",
                    "Make brief notes",
                    "Close promptly"
                ]'::jsonb,
                true
            );
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM maintenance_templates
            WHERE org_id = org_record.id AND task_type = 'first_opening_later_spring'
        ) THEN
            INSERT INTO maintenance_templates (
                org_id, name, description, task_type, default_duration_days,
                instructions, checklist_items, is_builtin
            ) VALUES (
                org_record.id,
                'Later Spring First Opening',
                'Growth & swarm management (Late March – Early May). Ask: Space? Swarm risk? Queen quality? Mating readiness?',
                'first_opening_later_spring',
                45,
                E'DON''T:\n• Don''t allow brood nest to become honey-bound\n• Don''t ignore queen cells\n• Don''t super too late\n• Don''t remove too much brood at once\n• Don''t expand during cold snaps\n• Don''t keep feeding blindly\n• Don''t confuse swarm prevention with swarm control\n• Don''t inspect too infrequently\n• Don''t split before drones are mature\n• Don''t treat weak colonies like strong ones\n• Don''t run out of spare kit\n• Don''t assume supers prevent swarming\n• Don''t forget weather forecast\n• Don''t ignore temperament changes\n\nKey biological rule:\n✔ Sealed drone brood = safe to replace queens or raise new ones.',
                '[
                    "Assess brood pattern and strength",
                    "Ensure space for brood expansion",
                    "Replace old dark brood frames gradually",
                    "Watch for swarm signs (queen cups, congestion)",
                    "Add supers before colony is desperate",
                    "Open brood nest slightly if strong",
                    "Equalise colonies if running several",
                    "Widen entrances as population grows",
                    "Remove mouse guards when nights warm",
                    "Check food balance (starving vs honey-bound)",
                    "Monitor Varroa properly",
                    "Improve ventilation as needed",
                    "Manage queen age and quality",
                    "Plan splits ahead of time",
                    "Confirm SEALED drone brood before requeening or splitting",
                    "Keep proper records"
                ]'::jsonb,
                true
            );
        END IF;
    END LOOP;
END $$;

-- Add seasonal event templates for spring opening windows (show on calendar as reference periods)
INSERT INTO seasonal_event_templates (name, event_type, description, default_start_month, default_start_day, default_end_month, default_end_day, region, color)
SELECT 'Early Spring First Opening Window', 'spring_buildup', 'Survival check window. Ask: Alive? Queenright? Fed? Healthy? Choose mild days (13-15°C) for inspections.', 2, 15, 3, 31, 'northern_hemisphere', '#8b5cf6'
WHERE NOT EXISTS (SELECT 1 FROM seasonal_event_templates WHERE name = 'Early Spring First Opening Window' AND region = 'northern_hemisphere');

INSERT INTO seasonal_event_templates (name, event_type, description, default_start_month, default_start_day, default_end_month, default_end_day, region, color)
SELECT 'Later Spring First Opening Window', 'spring_buildup', 'Growth & swarm management window. Ask: Space? Swarm risk? Queen quality? Sealed drone brood = safe to requeen or split.', 3, 25, 5, 15, 'northern_hemisphere', '#8b5cf6'
WHERE NOT EXISTS (SELECT 1 FROM seasonal_event_templates WHERE name = 'Later Spring First Opening Window' AND region = 'northern_hemisphere');

INSERT INTO seasonal_event_templates (name, event_type, description, default_start_month, default_start_day, default_end_month, default_end_day, region, color)
SELECT 'Early Spring First Opening Window (Southern)', 'spring_buildup', 'Survival check window. Ask: Alive? Queenright? Fed? Healthy? Choose mild days for inspections.', 8, 15, 9, 30, 'southern_hemisphere', '#8b5cf6'
WHERE NOT EXISTS (SELECT 1 FROM seasonal_event_templates WHERE name = 'Early Spring First Opening Window (Southern)' AND region = 'southern_hemisphere');

INSERT INTO seasonal_event_templates (name, event_type, description, default_start_month, default_start_day, default_end_month, default_end_day, region, color)
SELECT 'Later Spring First Opening Window (Southern)', 'spring_buildup', 'Growth & swarm management window. Ask: Space? Swarm risk? Queen quality? Sealed drone brood = safe to requeen or split.', 9, 25, 11, 15, 'southern_hemisphere', '#8b5cf6'
WHERE NOT EXISTS (SELECT 1 FROM seasonal_event_templates WHERE name = 'Later Spring First Opening Window (Southern)' AND region = 'southern_hemisphere');
