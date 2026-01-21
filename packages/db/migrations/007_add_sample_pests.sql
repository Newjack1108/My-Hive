-- Add sample global pests to pest_knowledge_base
-- This migration adds common bee pests that all organizations can access

-- Insert sample pests only if they don't already exist
INSERT INTO pest_knowledge_base (org_id, name, scientific_name, description, symptoms, prevention_methods, severity_level, is_global)
SELECT NULL, 'Varroa Mite', 'Varroa destructor', 
       'A parasitic mite that feeds on honey bees and transmits viruses. One of the most serious threats to honey bee colonies worldwide. Varroa mites attach to both adult bees and brood, feeding on hemolymph and spreading diseases.',
       'Deformed wings, reduced lifespan, weakened colonies, visible mites on adult bees, dead brood, crawling bees unable to fly, spotty brood pattern',
       'Regular monitoring with sticky boards, screened bottom boards, drone brood removal, resistant bee stock, maintaining strong colonies, avoiding stress',
       'high', true
WHERE NOT EXISTS (SELECT 1 FROM pest_knowledge_base WHERE name = 'Varroa Mite' AND is_global = true);

INSERT INTO pest_knowledge_base (org_id, name, scientific_name, description, symptoms, prevention_methods, severity_level, is_global)
SELECT NULL, 'Small Hive Beetle', 'Aethina tumida',
       'A destructive pest native to sub-Saharan Africa that has spread globally. The larvae feed on honey, pollen, and brood, causing fermentation and spoilage of stored honey.',
       'Slime on combs, fermented honey, larvae in comb cells, adult beetles hiding in cracks, weakened colony, absconding',
       'Maintain strong colonies, reduce hive entrances, keep hives in sunny locations, remove dead colonies promptly, use beetle traps, keep apiary clean',
       'high', true
WHERE NOT EXISTS (SELECT 1 FROM pest_knowledge_base WHERE name = 'Small Hive Beetle' AND is_global = true);

INSERT INTO pest_knowledge_base (org_id, name, scientific_name, description, symptoms, prevention_methods, severity_level, is_global)
SELECT NULL, 'Wax Moth', 'Galleria mellonella / Achroia grisella',
       'Moth larvae that feed on beeswax, pollen, and honey. They can destroy stored comb and weak colonies. Two species: Greater Wax Moth and Lesser Wax Moth.',
       'Webbing in comb, tunnels through wax, cocoons in frames, damaged comb structure, debris in bottom board, weak or dead colonies',
       'Maintain strong colonies, freeze stored comb, use moth crystals for storage, keep storage areas cool and well-ventilated, remove old comb regularly',
       'moderate', true
WHERE NOT EXISTS (SELECT 1 FROM pest_knowledge_base WHERE name = 'Wax Moth' AND is_global = true);

INSERT INTO pest_knowledge_base (org_id, name, scientific_name, description, symptoms, prevention_methods, severity_level, is_global)
SELECT NULL, 'American Foulbrood', 'Paenibacillus larvae',
       'A highly contagious and fatal bacterial disease affecting honey bee brood. Spores can remain viable for decades. Reportable disease in many regions.',
       'Sunken, perforated cappings, dark brown to black dead larvae, ropey test positive, foul odor, spotty brood pattern, scales that are difficult to remove',
       'Regular inspections, avoid feeding contaminated honey, practice good apiary hygiene, requeen regularly, burn infected equipment, report to authorities',
       'critical', true
WHERE NOT EXISTS (SELECT 1 FROM pest_knowledge_base WHERE name = 'American Foulbrood' AND is_global = true);

INSERT INTO pest_knowledge_base (org_id, name, scientific_name, description, symptoms, prevention_methods, severity_level, is_global)
SELECT NULL, 'European Foulbrood', 'Melissococcus plutonius',
       'A bacterial disease that affects honey bee larvae. Less severe than American Foulbrood but can still cause significant colony losses, especially in stressed colonies.',
       'Twisted, discolored dead larvae, yellow to brown larvae, sour odor, spotty brood pattern, scales easily removed, often affects young larvae',
       'Maintain strong colonies, reduce stress, requeen with resistant stock, good nutrition, proper ventilation, avoid overcrowding',
       'high', true
WHERE NOT EXISTS (SELECT 1 FROM pest_knowledge_base WHERE name = 'European Foulbrood' AND is_global = true);

INSERT INTO pest_knowledge_base (org_id, name, scientific_name, description, symptoms, prevention_methods, severity_level, is_global)
SELECT NULL, 'Nosema', 'Nosema apis / Nosema ceranae',
       'A fungal disease caused by microsporidian parasites that infect the digestive tract of adult honey bees. Can cause dysentery and reduced lifespan.',
       'Dysentery (brown streaks on hive), crawling bees, reduced lifespan, weakened colonies, reduced honey production, increased winter losses',
       'Good ventilation, clean water sources, replace old comb, avoid stress, proper nutrition, medication when necessary, maintain strong colonies',
       'moderate', true
WHERE NOT EXISTS (SELECT 1 FROM pest_knowledge_base WHERE name = 'Nosema' AND is_global = true);

INSERT INTO pest_knowledge_base (org_id, name, scientific_name, description, symptoms, prevention_methods, severity_level, is_global)
SELECT NULL, 'Chalkbrood', 'Ascosphaera apis',
       'A fungal disease that affects honey bee larvae. Infected larvae turn chalky white and become mummified. More common in cool, damp conditions.',
       'Chalky white or gray mummified larvae, irregular brood pattern, mummies in cells or on bottom board, reduced population',
       'Maintain strong colonies, ensure good ventilation, keep hives dry, replace old comb, requeen with resistant stock, avoid damp locations',
       'low', true
WHERE NOT EXISTS (SELECT 1 FROM pest_knowledge_base WHERE name = 'Chalkbrood' AND is_global = true);

INSERT INTO pest_knowledge_base (org_id, name, scientific_name, description, symptoms, prevention_methods, severity_level, is_global)
SELECT NULL, 'Tracheal Mites', 'Acarapis woodi',
       'Microscopic mites that infest the breathing tubes (tracheae) of adult honey bees. They can weaken bees and reduce colony strength, especially in winter.',
       'Crawling bees unable to fly, K-wing appearance, reduced lifespan, weakened colonies, increased winter losses, bees clustering outside hive',
       'Use resistant bee stock, maintain strong colonies, good ventilation, menthol treatments when necessary, avoid stress, proper nutrition',
       'moderate', true
WHERE NOT EXISTS (SELECT 1 FROM pest_knowledge_base WHERE name = 'Tracheal Mites' AND is_global = true);
