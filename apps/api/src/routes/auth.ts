import express from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { generateToken } from '../middleware/auth.js';
import { LoginSchema } from '@my-hive/shared';
import { logActivity } from '../utils/activity.js';

export const authRouter = express.Router();

// One-time seed endpoint (remove after first use for security)
authRouter.post('/seed', async (req, res, next) => {
    try {
        // Check if any users exist
        const userCheck = await pool.query('SELECT COUNT(*) as count FROM users');
        if (parseInt(userCheck.rows[0].count) > 0) {
            return res.status(400).json({ error: 'Database already seeded' });
        }

        // Create sample organisation
        const orgResult = await pool.query(
            `INSERT INTO organisations (name) 
             VALUES ('Sample Apiary Co.') 
             ON CONFLICT DO NOTHING
             RETURNING id`
        );
        
        let orgId;
        if (orgResult.rows.length > 0) {
            orgId = orgResult.rows[0].id;
        } else {
            const existing = await pool.query('SELECT id FROM organisations LIMIT 1');
            orgId = existing.rows[0].id;
        }

        // Create admin user (password: admin123)
        const adminHash = await bcrypt.hash('admin123', 10);
        const adminResult = await pool.query(
            `INSERT INTO users (org_id, email, name, role, password_hash) 
             VALUES ($1, 'admin@example.com', 'Admin User', 'admin', $2)
             ON CONFLICT (email) DO NOTHING
             RETURNING id`,
            [orgId, adminHash]
        );

        // Create apiary
        const apiaryResult = await pool.query(
            `INSERT INTO apiaries (org_id, name, description, lat, lng) 
             VALUES ($1, 'Main Apiary', 'Primary location for beekeeping operations', 37.7749, -122.4194)
             RETURNING id`,
            [orgId]
        );
        const apiaryId = apiaryResult.rows[0].id;

        // Create sample hives
        for (let i = 1; i <= 5; i++) {
            const publicId = `HIVE-${String(i).padStart(3, '0')}`;
            await pool.query(
                `INSERT INTO hives (org_id, apiary_id, public_id, label, status) 
                 VALUES ($1, $2, $3, $4, 'active')
                 ON CONFLICT (public_id) DO NOTHING`,
                [orgId, apiaryId, publicId, `Hive ${i}`]
            );
        }

        // Create inspector user (password: inspector123)
        const inspectorHash = await bcrypt.hash('inspector123', 10);
        await pool.query(
            `INSERT INTO users (org_id, email, name, role, password_hash) 
             VALUES ($1, 'inspector@example.com', 'Inspector User', 'inspector', $2)
             ON CONFLICT (email) DO NOTHING`,
            [orgId, inspectorHash]
        );

        // Create sample global pests
        const samplePests = [
            {
                name: 'Varroa Mite',
                scientific_name: 'Varroa destructor',
                description: 'A parasitic mite that feeds on honey bees and transmits viruses. One of the most serious threats to honey bee colonies worldwide. Varroa mites attach to both adult bees and brood, feeding on hemolymph and spreading diseases.',
                symptoms: 'Deformed wings, reduced lifespan, weakened colonies, visible mites on adult bees, dead brood, crawling bees unable to fly, spotty brood pattern',
                severity_level: 'high',
                prevention_methods: 'Regular monitoring with sticky boards, screened bottom boards, drone brood removal, resistant bee stock, maintaining strong colonies, avoiding stress'
            },
            {
                name: 'Small Hive Beetle',
                scientific_name: 'Aethina tumida',
                description: 'A destructive pest native to sub-Saharan Africa that has spread globally. The larvae feed on honey, pollen, and brood, causing fermentation and spoilage of stored honey.',
                symptoms: 'Slime on combs, fermented honey, larvae in comb cells, adult beetles hiding in cracks, weakened colony, absconding',
                severity_level: 'high',
                prevention_methods: 'Maintain strong colonies, reduce hive entrances, keep hives in sunny locations, remove dead colonies promptly, use beetle traps, keep apiary clean'
            },
            {
                name: 'Wax Moth',
                scientific_name: 'Galleria mellonella / Achroia grisella',
                description: 'Moth larvae that feed on beeswax, pollen, and honey. They can destroy stored comb and weak colonies. Two species: Greater Wax Moth and Lesser Wax Moth.',
                symptoms: 'Webbing in comb, tunnels through wax, cocoons in frames, damaged comb structure, debris in bottom board, weak or dead colonies',
                severity_level: 'moderate',
                prevention_methods: 'Maintain strong colonies, freeze stored comb, use moth crystals for storage, keep storage areas cool and well-ventilated, remove old comb regularly'
            },
            {
                name: 'American Foulbrood',
                scientific_name: 'Paenibacillus larvae',
                description: 'A highly contagious and fatal bacterial disease affecting honey bee brood. Spores can remain viable for decades. Reportable disease in many regions.',
                symptoms: 'Sunken, perforated cappings, dark brown to black dead larvae, ropey test positive, foul odor, spotty brood pattern, scales that are difficult to remove',
                severity_level: 'critical',
                prevention_methods: 'Regular inspections, avoid feeding contaminated honey, practice good apiary hygiene, requeen regularly, burn infected equipment, report to authorities'
            },
            {
                name: 'European Foulbrood',
                scientific_name: 'Melissococcus plutonius',
                description: 'A bacterial disease that affects honey bee larvae. Less severe than American Foulbrood but can still cause significant colony losses, especially in stressed colonies.',
                symptoms: 'Twisted, discolored dead larvae, yellow to brown larvae, sour odor, spotty brood pattern, scales easily removed, often affects young larvae',
                severity_level: 'high',
                prevention_methods: 'Maintain strong colonies, reduce stress, requeen with resistant stock, good nutrition, proper ventilation, avoid overcrowding'
            },
            {
                name: 'Nosema',
                scientific_name: 'Nosema apis / Nosema ceranae',
                description: 'A fungal disease caused by microsporidian parasites that infect the digestive tract of adult honey bees. Can cause dysentery and reduced lifespan.',
                symptoms: 'Dysentery (brown streaks on hive), crawling bees, reduced lifespan, weakened colonies, reduced honey production, increased winter losses',
                severity_level: 'moderate',
                prevention_methods: 'Good ventilation, clean water sources, replace old comb, avoid stress, proper nutrition, medication when necessary, maintain strong colonies'
            },
            {
                name: 'Chalkbrood',
                scientific_name: 'Ascosphaera apis',
                description: 'A fungal disease that affects honey bee larvae. Infected larvae turn chalky white and become mummified. More common in cool, damp conditions.',
                symptoms: 'Chalky white or gray mummified larvae, irregular brood pattern, mummies in cells or on bottom board, reduced population',
                severity_level: 'low',
                prevention_methods: 'Maintain strong colonies, ensure good ventilation, keep hives dry, replace old comb, requeen with resistant stock, avoid damp locations'
            },
            {
                name: 'Tracheal Mites',
                scientific_name: 'Acarapis woodi',
                description: 'Microscopic mites that infest the breathing tubes (tracheae) of adult honey bees. They can weaken bees and reduce colony strength, especially in winter.',
                symptoms: 'Crawling bees unable to fly, K-wing appearance, reduced lifespan, weakened colonies, increased winter losses, bees clustering outside hive',
                severity_level: 'moderate',
                prevention_methods: 'Use resistant bee stock, maintain strong colonies, good ventilation, menthol treatments when necessary, avoid stress, proper nutrition'
            }
        ];

        for (const pest of samplePests) {
            // Check if pest already exists
            const existing = await pool.query(
                'SELECT id FROM pest_knowledge_base WHERE name = $1 AND is_global = true',
                [pest.name]
            );
            
            if (existing.rows.length === 0) {
                await pool.query(`
                    INSERT INTO pest_knowledge_base (org_id, name, scientific_name, description, symptoms, prevention_methods, severity_level, is_global)
                    VALUES (NULL, $1, $2, $3, $4, $5, $6, true)
                `, [
                    pest.name,
                    pest.scientific_name,
                    pest.description,
                    pest.symptoms,
                    pest.prevention_methods,
                    pest.severity_level
                ]);
            }
        }

        res.json({ 
            message: 'Database seeded successfully', 
            credentials: {
                admin: 'admin@example.com / admin123',
                inspector: 'inspector@example.com / inspector123'
            }
        });
    } catch (error) {
        next(error);
    }
});

// Login
authRouter.post('/login', async (req, res, next) => {
    try {
        const { email, password } = LoginSchema.parse(req.body);

        const result = await pool.query(
            'SELECT id, email, name, org_id, role, password_hash FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        if (!user.password_hash) {
            return res.status(401).json({ error: 'Password authentication not available' });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await pool.query(
            'UPDATE users SET last_login_at = NOW() WHERE id = $1',
            [user.id]
        );

        const token = generateToken(user.id, user.email, user.org_id, user.role);

        // Log activity
        await logActivity(user.org_id, user.id, 'login', null, null, {});

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                org_id: user.org_id,
                role: user.role,
            },
        });
    } catch (error) {
        next(error);
    }
});

// Get current user
authRouter.get('/me', async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const jwt = await import('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
        const decoded = jwt.default.verify(token, JWT_SECRET) as { userId: string };

        const result = await pool.query(
            'SELECT id, email, name, org_id, role FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        res.json({ user: result.rows[0] });
    } catch (error) {
        next(error);
    }
});
