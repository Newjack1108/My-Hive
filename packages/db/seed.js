import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/myhive';

async function seed() {
    const client = new Client({
        connectionString: DATABASE_URL,
    });

    try {
        await client.connect();
        console.log('Connected to database');

        // Create sample organisation
        const orgResult = await client.query(`
            INSERT INTO organisations (name) 
            VALUES ('Sample Apiary Co.') 
            ON CONFLICT DO NOTHING
            RETURNING id
        `);
        
        let orgId;
        if (orgResult.rows.length > 0) {
            orgId = orgResult.rows[0].id;
            console.log('Created organisation:', orgId);
        } else {
            const existing = await client.query('SELECT id FROM organisations LIMIT 1');
            orgId = existing.rows[0].id;
            console.log('Using existing organisation:', orgId);
        }

        // Create admin user (password: admin123)
        const passwordHash = await bcrypt.hash('admin123', 10);
        const userResult = await client.query(`
            INSERT INTO users (org_id, email, name, role, password_hash) 
            VALUES ($1, 'admin@example.com', 'Admin User', 'admin', $2)
            ON CONFLICT (email) DO NOTHING
            RETURNING id
        `, [orgId, passwordHash]);

        let adminUserId;
        if (userResult.rows.length > 0) {
            adminUserId = userResult.rows[0].id;
            console.log('Created admin user:', adminUserId);
        } else {
            const existing = await client.query('SELECT id FROM users WHERE email = $1', ['admin@example.com']);
            adminUserId = existing.rows[0].id;
            console.log('Using existing admin user:', adminUserId);
        }

        // Create sample apiary
        const apiaryResult = await client.query(`
            INSERT INTO apiaries (org_id, name, description, lat, lng) 
            VALUES ($1, 'Main Apiary', 'Primary location for beekeeping operations', 37.7749, -122.4194)
            RETURNING id
        `, [orgId]);

        const apiaryId = apiaryResult.rows[0].id;
        console.log('Created apiary:', apiaryId);

        // Create sample hives
        const hiveIds = [];
        for (let i = 1; i <= 5; i++) {
            const publicId = `HIVE-${String(i).padStart(3, '0')}`;
            const hiveResult = await client.query(`
                INSERT INTO hives (org_id, apiary_id, public_id, label, status) 
                VALUES ($1, $2, $3, $4, 'active')
                ON CONFLICT (public_id) DO NOTHING
                RETURNING id
            `, [orgId, apiaryId, publicId, `Hive ${i}`]);

            if (hiveResult.rows.length > 0) {
                hiveIds.push(hiveResult.rows[0].id);
                console.log(`Created hive ${i}: ${publicId}`);
            }
        }

        // Create inspector user (password: inspector123)
        const inspectorHash = await bcrypt.hash('inspector123', 10);
        const inspectorResult = await client.query(`
            INSERT INTO users (org_id, email, name, role, password_hash) 
            VALUES ($1, 'inspector@example.com', 'Inspector User', 'inspector', $2)
            ON CONFLICT (email) DO NOTHING
            RETURNING id
        `, [orgId, inspectorHash]);

        if (inspectorResult.rows.length > 0) {
            console.log('Created inspector user:', inspectorResult.rows[0].id);
        }

        // Create a sample task
        if (hiveIds.length > 0) {
            await client.query(`
                INSERT INTO tasks (org_id, hive_id, type, title, description, due_date, assigned_user_id, status)
                VALUES ($1, $2, 'inspection_due', 'Routine Inspection', 'Perform weekly inspection', 
                        CURRENT_DATE + INTERVAL '3 days', $3, 'pending')
            `, [orgId, hiveIds[0], adminUserId]);
            console.log('Created sample task');
        }

        console.log('Seed completed successfully');
        console.log('\nSample credentials:');
        console.log('Admin: admin@example.com / admin123');
        console.log('Inspector: inspector@example.com / inspector123');
    } catch (error) {
        console.error('Seed failed:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

seed();
