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
            const existing = await client.query(
                'SELECT id FROM pest_knowledge_base WHERE name = $1 AND is_global = true',
                [pest.name]
            );
            
            if (existing.rows.length === 0) {
                await client.query(`
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
        console.log(`Created ${samplePests.length} sample pests`);

        // Shop categories and example products
        const shopCategories = [
            { name: 'Hive & Frames', description: 'Hive bodies, frames, supers' },
            { name: 'Bee Equipment', description: 'Suits, smokers, hive tools' },
            { name: 'Feeding & Care', description: 'Feeders, fondant, supplements' },
            { name: 'Honey Processing', description: 'Extractors, jars, uncapping tools' },
            { name: 'Clothing', description: 'Veils, gloves, protective wear' },
        ];
        const categoryIds = {};
        for (const cat of shopCategories) {
            const existing = await client.query(
                'SELECT id FROM product_categories WHERE org_id = $1 AND name = $2',
                [orgId, cat.name]
            );
            if (existing.rows.length === 0) {
                const ins = await client.query(
                    `INSERT INTO product_categories (org_id, name, description)
                     VALUES ($1, $2, $3) RETURNING id`,
                    [orgId, cat.name, cat.description]
                );
                categoryIds[cat.name] = ins.rows[0].id;
                console.log('Created category:', cat.name);
            } else {
                categoryIds[cat.name] = existing.rows[0].id;
            }
        }

        const exampleProducts = [
            { name: 'Langstroth Deep Hive Body', description: 'Standard 10-frame deep hive body, untreated pine.', price: 42.99, stock: 15, category: 'Hive & Frames', sku: 'HF-DEEP-01' },
            { name: 'Beehive Frames (10pk)', description: 'Pre-assembled wooden frames with wax foundation.', price: 24.50, stock: 50, category: 'Hive & Frames', sku: 'HF-FRM-10' },
            { name: 'Honey Super', description: 'Medium super for honey storage, 6-5/8" depth.', price: 38.00, stock: 20, category: 'Hive & Frames', sku: 'HF-SUP-01' },
            { name: 'Professional Bee Suit', description: 'Full coverage ventilated bee suit with attached veil.', price: 89.99, stock: 8, category: 'Bee Equipment', sku: 'BE-SUIT-01' },
            { name: 'Bee Smoker', description: 'Stainless steel smoker with heat shield and bellows.', price: 34.99, stock: 12, category: 'Bee Equipment', sku: 'BE-SMOK-01' },
            { name: 'Stainless Hive Tool', description: 'J-hook hive tool, rust-resistant stainless steel.', price: 12.99, stock: 25, category: 'Bee Equipment', sku: 'BE-TOOL-01' },
            { name: 'Boardman Feeder', description: 'Entrance feeder for supplemental feeding, holds 1 quart.', price: 8.99, stock: 30, category: 'Feeding & Care', sku: 'FC-FEED-01' },
            { name: 'Bee Fondant 1kg', description: 'Ready-to-use fondant for winter feeding.', price: 14.50, stock: 24, category: 'Feeding & Care', sku: 'FC-FOND-01' },
            { name: 'Pollen Patties', description: 'Protein supplement patties, 1 lb pack.', price: 18.99, stock: 20, category: 'Feeding & Care', sku: 'FC-POLL-01' },
            { name: 'Manual Honey Extractor', description: '4-frame tangential manual extractor.', price: 189.99, stock: 5, category: 'Honey Processing', sku: 'HP-EXTR-01' },
            { name: 'Uncapping Knife', description: 'Electric heated uncapping knife.', price: 44.99, stock: 10, category: 'Honey Processing', sku: 'HP-UNCP-01' },
            { name: 'Glass Honey Jars (12pk)', description: '8 oz amber glass jars with lids, 12 per case.', price: 22.00, stock: 40, category: 'Honey Processing', sku: 'HP-JAR-12' },
            { name: 'Beekeeper Veil', description: 'Round veil with hat, comfortable and durable.', price: 28.99, stock: 15, category: 'Clothing', sku: 'CL-VEIL-01' },
            { name: 'Leather Beekeeping Gloves', description: 'Goatskin gloves with long gauntlets.', price: 24.99, stock: 18, category: 'Clothing', sku: 'CL-GLV-01' },
        ];
        for (const p of exampleProducts) {
            const catId = categoryIds[p.category];
            if (!catId) continue;
            const exists = await client.query(
                'SELECT id FROM products WHERE org_id = $1 AND name = $2',
                [orgId, p.name]
            );
            if (exists.rows.length === 0) {
                await client.query(
                    `INSERT INTO products (org_id, category_id, name, description, price, stock_quantity, sku, active)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
                    [orgId, catId, p.name, p.description, p.price, p.stock, p.sku]
                );
                console.log('Created product:', p.name);
            }
        }
        console.log(`Created ${exampleProducts.length} example shop products`);

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
