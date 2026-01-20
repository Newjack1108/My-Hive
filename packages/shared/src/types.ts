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
