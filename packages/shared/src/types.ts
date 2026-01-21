import { z } from 'zod';

export type UserRole = 'admin' | 'manager' | 'inspector' | 'viewer';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type HiveStatus = 'active' | 'inactive' | 'retired';

// Auth schemas
export const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

export const CreateUserSchema = z.object({
    email: z.string().email(),
    name: z.string().min(1),
    role: z.enum(['admin', 'manager', 'inspector', 'viewer']),
    password: z.string().min(8).optional(),
    sendMagicLink: z.boolean().optional(),
});

// Organisation schemas
export const CreateOrganisationSchema = z.object({
    name: z.string().min(1).max(255),
});

// Apiary schemas
export const CreateApiarySchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
});

export const UpdateApiarySchema = CreateApiarySchema.partial();

// Hive schemas
export const CreateHiveSchema = z.object({
    apiary_id: z.string().uuid().optional(),
    public_id: z.string().min(1).max(50),
    label: z.string().min(1).max(255),
    status: z.enum(['active', 'inactive', 'retired']).optional(),
});

export const UpdateHiveSchema = z.object({
    apiary_id: z.string().uuid().optional().nullable(),
    label: z.string().min(1).max(255).optional(),
    status: z.enum(['active', 'inactive', 'retired']).optional(),
});

// Inspection section schemas
export const InspectionSectionsSchema = z.object({
    queen: z.object({
        present: z.boolean().optional(),
        marked: z.boolean().optional(),
        clipped: z.boolean().optional(),
        notes: z.string().optional(),
    }).optional(),
    brood: z.object({
        frames: z.number().min(0).max(10).optional(),
        pattern: z.enum(['excellent', 'good', 'spotty', 'poor']).optional(),
        notes: z.string().optional(),
    }).optional(),
    strength: z.object({
        frames: z.number().min(0).max(10).optional(),
        population: z.enum(['strong', 'moderate', 'weak']).optional(),
        notes: z.string().optional(),
    }).optional(),
    stores: z.object({
        honey: z.enum(['heavy', 'moderate', 'light', 'none']).optional(),
        pollen: z.enum(['heavy', 'moderate', 'light', 'none']).optional(),
        notes: z.string().optional(),
    }).optional(),
    temperament: z.object({
        rating: z.enum(['calm', 'moderate', 'aggressive']).optional(),
        notes: z.string().optional(),
    }).optional(),
    health: z.object({
        pests: z.array(z.string()).optional(),
        diseases: z.array(z.string()).optional(),
        notes: z.string().optional(),
    }).optional(),
});

// Inspection schemas
export const CreateInspectionSchema = z.object({
    hive_id: z.string().uuid(),
    started_at: z.string().datetime(),
    ended_at: z.string().datetime().optional(),
    location_lat: z.number().min(-90).max(90).optional().nullable(),
    location_lng: z.number().min(-180).max(180).optional().nullable(),
    location_accuracy_m: z.number().min(0).optional().nullable(),
    offline_created_at: z.string().datetime().optional(),
    client_uuid: z.string().uuid(),
    sections_json: InspectionSectionsSchema.optional(),
    notes: z.string().optional(),
});

export const UpdateInspectionSchema = z.object({
    ended_at: z.string().datetime().optional(),
    sections_json: InspectionSectionsSchema.optional(),
    notes: z.string().optional(),
});

// Treatment schemas
export const CreateTreatmentSchema = z.object({
    inspection_id: z.string().uuid().optional(),
    type: z.string().min(1).max(100),
    product: z.string().min(1).max(255),
    batch: z.string().max(100).optional(),
    dose: z.string().max(255).optional(),
    method: z.string().max(255).optional(),
    withdrawal_end_date: z.string().date().optional(),
});

// Maintenance check schemas
export const CreateMaintenanceCheckSchema = z.object({
    inspection_id: z.string().uuid().optional(),
    hive_id: z.string().uuid(),
    condition_fields: z.record(z.any()).optional(),
    notes: z.string().optional(),
});

// Task schemas
export const CreateTaskSchema = z.object({
    hive_id: z.string().uuid().optional(),
    inspection_id: z.string().uuid().optional(),
    type: z.string().min(1).max(100),
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    due_date: z.string().date(),
    assigned_user_id: z.string().uuid().optional(),
});

export const UpdateTaskSchema = z.object({
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
    title: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    due_date: z.string().date().optional(),
    assigned_user_id: z.string().uuid().optional().nullable(),
});

// Photo upload schema
export const PhotoUploadSchema = z.object({
    inspection_id: z.string().uuid(),
});

// Sync queue item
export const SyncQueueItemSchema = z.object({
    entity_type: z.string(),
    entity_id: z.string().uuid().optional(),
    client_uuid: z.string().uuid(),
    action: z.enum(['create', 'update']),
    payload_json: z.record(z.any()),
});

// Phase 2: Map/Apiary schemas
export const UpdateApiaryWithRadiusSchema = z.object({
    feeding_radius_m: z.number().min(0).optional(),
    radius_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

// Phase 2: Queen schemas
export const CreateQueenRecordSchema = z.object({
    hive_id: z.string().uuid().optional(),
    name: z.string().max(255).optional(),
    lineage: z.string().max(255).optional(),
    birth_date: z.string().date().optional(),
    status: z.enum(['active', 'replaced', 'dead', 'unknown']).optional(),
    notes: z.string().optional(),
});

export const UpdateQueenRecordSchema = CreateQueenRecordSchema.partial();

export const CreateBreedingPlanSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    target_traits: z.record(z.any()).optional(),
    timeline_start: z.string().date().optional(),
    timeline_end: z.string().date().optional(),
    status: z.enum(['planning', 'active', 'completed', 'cancelled']).optional(),
});

export const UpdateBreedingPlanSchema = CreateBreedingPlanSchema.partial();

export const CreateQueenLineageSchema = z.object({
    queen_id: z.string().uuid(),
    parent_queen_id: z.string().uuid().optional(),
    parent_drone_source: z.string().max(255).optional(),
    generation: z.number().int().min(1).optional(),
});

export const CreateBreedingMatchSchema = z.object({
    breeding_plan_id: z.string().uuid(),
    queen_id: z.string().uuid(),
    drone_source: z.string().max(255).optional(),
    planned_date: z.string().date().optional(),
    status: z.enum(['planned', 'completed', 'cancelled']).optional(),
    notes: z.string().optional(),
});

// Phase 2: Shop schemas
export const CreateProductCategorySchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
});

export const CreateProductSchema = z.object({
    category_id: z.string().uuid().optional(),
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    price: z.number().min(0),
    stock_quantity: z.number().int().min(0).optional(),
    sku: z.string().max(100).optional(),
    image_url: z.string().url().optional(),
    active: z.boolean().optional(),
});

export const UpdateProductSchema = CreateProductSchema.partial();

export const AddToCartSchema = z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().min(1),
});

export const UpdateCartItemSchema = z.object({
    quantity: z.number().int().min(1),
});

export const CheckoutSchema = z.object({
    shipping_address: z.string().optional(),
    payment_method: z.string().max(100).optional(),
});

// Phase 2: Honey schemas
export const CreateHoneyHarvestSchema = z.object({
    hive_id: z.string().uuid(),
    harvest_date: z.string().date(),
    weight_kg: z.number().min(0),
    frames: z.number().int().min(0).optional(),
    notes: z.string().optional(),
});

export const UpdateHoneyHarvestSchema = CreateHoneyHarvestSchema.partial();

export const CreateHoneyStorageSchema = z.object({
    location_name: z.string().min(1).max(255),
    location_type: z.enum(['jar', 'bucket', 'barrel', 'other']).optional(),
    capacity_kg: z.number().min(0).optional(),
    current_quantity_kg: z.number().min(0).optional(),
    notes: z.string().optional(),
});

export const UpdateHoneyStorageSchema = CreateHoneyStorageSchema.partial();

export const CreateHoneyBatchSchema = z.object({
    harvest_id: z.string().uuid().optional(),
    batch_number: z.string().min(1).max(100),
    processing_date: z.string().date().optional(),
    weight_kg: z.number().min(0).optional(),
    quality_metrics: z.record(z.any()).optional(),
    storage_location_id: z.string().uuid().optional(),
});

// Phase 2: Pest schemas
export const CreatePestKnowledgeBaseSchema = z.object({
    name: z.string().min(1).max(255),
    scientific_name: z.string().max(255).optional(),
    description: z.string().optional(),
    symptoms: z.string().optional(),
    treatment_options: z.record(z.any()).optional(),
    prevention_methods: z.string().optional(),
    severity_level: z.enum(['low', 'moderate', 'high', 'critical']).optional(),
    is_global: z.boolean().optional(),
});

export const UpdatePestKnowledgeBaseSchema = CreatePestKnowledgeBaseSchema.partial();

export const CreatePestTreatmentSchema = z.object({
    pest_id: z.string().uuid(),
    treatment_name: z.string().min(1).max(255),
    treatment_method: z.string().optional(),
    products: z.string().optional(),
    application_instructions: z.string().optional(),
    effectiveness_rating: z.number().int().min(1).max(5).optional(),
    is_global: z.boolean().optional(),
});

export const CreatePestOccurrenceSchema = z.object({
    hive_id: z.string().uuid(),
    pest_id: z.string().uuid(),
    inspection_id: z.string().uuid().optional(),
    occurrence_date: z.string().date(),
    severity: z.enum(['low', 'moderate', 'high', 'critical']).optional(),
    notes: z.string().optional(),
});

export const CreateTreatmentEffectivenessSchema = z.object({
    pest_occurrence_id: z.string().uuid(),
    treatment_id: z.string().uuid(),
    treatment_date: z.string().date(),
    effectiveness_rating: z.number().int().min(1).max(5).optional(),
    notes: z.string().optional(),
});

// Phase 2: Maintenance schemas
export const CreateMaintenanceTemplateSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    task_type: z.string().min(1).max(100),
    default_duration_days: z.number().int().min(0).optional(),
    instructions: z.string().optional(),
    checklist_items: z.array(z.string()).optional(),
});

export const UpdateMaintenanceTemplateSchema = CreateMaintenanceTemplateSchema.partial();

export const CreateMaintenanceScheduleSchema = z.object({
    template_id: z.string().uuid().optional(),
    hive_id: z.string().uuid().optional(),
    name: z.string().min(1).max(255),
    frequency_type: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom']),
    frequency_value: z.number().int().min(1).optional(),
    next_due_date: z.string().date(),
    is_active: z.boolean().optional(),
});

export const UpdateMaintenanceScheduleSchema = z.object({
    template_id: z.string().uuid().optional().nullable(),
    hive_id: z.string().uuid().optional().nullable(),
    name: z.string().min(1).max(255).optional(),
    frequency_type: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom']).optional(),
    frequency_value: z.number().int().min(1).optional(),
    next_due_date: z.string().date().optional(),
    is_active: z.boolean().optional(),
});

export const CreateMaintenanceHistorySchema = z.object({
    schedule_id: z.string().uuid().optional(),
    hive_id: z.string().uuid(),
    completed_date: z.string().date(),
    notes: z.string().optional(),
    checklist_completed: z.array(z.boolean()).optional(),
    inspection_id: z.string().uuid().optional(),
});

export const UpdateTaskWithPrioritySchema = z.object({
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
    title: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    due_date: z.string().date().optional(),
    assigned_user_id: z.string().uuid().optional().nullable(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    recurring_schedule_id: z.string().uuid().optional().nullable(),
    template_id: z.string().uuid().optional().nullable(),
});

// Type exports
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type CreateOrganisationInput = z.infer<typeof CreateOrganisationSchema>;
export type CreateApiaryInput = z.infer<typeof CreateApiarySchema>;
export type UpdateApiaryInput = z.infer<typeof UpdateApiarySchema>;
export type CreateHiveInput = z.infer<typeof CreateHiveSchema>;
export type UpdateHiveInput = z.infer<typeof UpdateHiveSchema>;
export type InspectionSections = z.infer<typeof InspectionSectionsSchema>;
export type CreateInspectionInput = z.infer<typeof CreateInspectionSchema>;
export type UpdateInspectionInput = z.infer<typeof UpdateInspectionSchema>;
export type CreateTreatmentInput = z.infer<typeof CreateTreatmentSchema>;
export type CreateMaintenanceCheckInput = z.infer<typeof CreateMaintenanceCheckSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type PhotoUploadInput = z.infer<typeof PhotoUploadSchema>;
export type SyncQueueItem = z.infer<typeof SyncQueueItemSchema>;

// Phase 2 type exports
export type UpdateApiaryWithRadiusInput = z.infer<typeof UpdateApiaryWithRadiusSchema>;
export type CreateQueenRecordInput = z.infer<typeof CreateQueenRecordSchema>;
export type UpdateQueenRecordInput = z.infer<typeof UpdateQueenRecordSchema>;
export type CreateBreedingPlanInput = z.infer<typeof CreateBreedingPlanSchema>;
export type UpdateBreedingPlanInput = z.infer<typeof UpdateBreedingPlanSchema>;
export type CreateQueenLineageInput = z.infer<typeof CreateQueenLineageSchema>;
export type CreateBreedingMatchInput = z.infer<typeof CreateBreedingMatchSchema>;
export type CreateProductCategoryInput = z.infer<typeof CreateProductCategorySchema>;
export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type AddToCartInput = z.infer<typeof AddToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>;
export type CheckoutInput = z.infer<typeof CheckoutSchema>;
export type CreateHoneyHarvestInput = z.infer<typeof CreateHoneyHarvestSchema>;
export type UpdateHoneyHarvestInput = z.infer<typeof UpdateHoneyHarvestSchema>;
export type CreateHoneyStorageInput = z.infer<typeof CreateHoneyStorageSchema>;
export type UpdateHoneyStorageInput = z.infer<typeof UpdateHoneyStorageSchema>;
export type CreateHoneyBatchInput = z.infer<typeof CreateHoneyBatchSchema>;
export type CreatePestKnowledgeBaseInput = z.infer<typeof CreatePestKnowledgeBaseSchema>;
export type UpdatePestKnowledgeBaseInput = z.infer<typeof UpdatePestKnowledgeBaseSchema>;
export type CreatePestTreatmentInput = z.infer<typeof CreatePestTreatmentSchema>;
export type CreatePestOccurrenceInput = z.infer<typeof CreatePestOccurrenceSchema>;
export type CreateTreatmentEffectivenessInput = z.infer<typeof CreateTreatmentEffectivenessSchema>;
export type CreateMaintenanceTemplateInput = z.infer<typeof CreateMaintenanceTemplateSchema>;
export type UpdateMaintenanceTemplateInput = z.infer<typeof UpdateMaintenanceTemplateSchema>;
export type CreateMaintenanceScheduleInput = z.infer<typeof CreateMaintenanceScheduleSchema>;
export type UpdateMaintenanceScheduleInput = z.infer<typeof UpdateMaintenanceScheduleSchema>;
export type CreateMaintenanceHistoryInput = z.infer<typeof CreateMaintenanceHistorySchema>;
export type UpdateTaskWithPriorityInput = z.infer<typeof UpdateTaskWithPrioritySchema>;

// Weather schemas
export const WeatherCurrentSchema = z.object({
    temp: z.number(),
    feels_like: z.number(),
    humidity: z.number(),
    pressure: z.number(),
    wind_speed: z.number(),
    wind_direction: z.number().optional(),
    visibility: z.number().optional(),
    conditions: z.string(),
    icon: z.string(),
    description: z.string(),
});

export const WeatherForecastItemSchema = z.object({
    date: z.string(),
    temp_min: z.number(),
    temp_max: z.number(),
    conditions: z.string(),
    icon: z.string(),
    description: z.string(),
    humidity: z.number().optional(),
    wind_speed: z.number().optional(),
});

export const WeatherHistoricalSchema = z.object({
    date: z.string(),
    temp: z.number(),
    temp_min: z.number().optional(),
    temp_max: z.number().optional(),
    humidity: z.number().optional(),
    pressure: z.number().optional(),
    wind_speed: z.number().optional(),
    conditions: z.string(),
    icon: z.string(),
    description: z.string(),
});

export const WeatherDataSchema = z.object({
    current: WeatherCurrentSchema,
    forecast: z.array(WeatherForecastItemSchema).optional(),
    historical: WeatherHistoricalSchema.optional(),
    timestamp: z.string(),
    location: z.object({
        lat: z.number(),
        lng: z.number(),
    }),
});

// Weather type exports
export type WeatherCurrent = z.infer<typeof WeatherCurrentSchema>;
export type WeatherForecastItem = z.infer<typeof WeatherForecastItemSchema>;
export type WeatherHistorical = z.infer<typeof WeatherHistoricalSchema>;
export type WeatherData = z.infer<typeof WeatherDataSchema>;