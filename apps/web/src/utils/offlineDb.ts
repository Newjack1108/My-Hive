import Dexie, { Table } from 'dexie';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface OfflineInspection {
  id?: number;
  client_uuid: string;
  hive_id: string;
  started_at: string;
  ended_at?: string;
  location_lat?: number | null;
  location_lng?: number | null;
  location_accuracy_m?: number | null;
  offline_created_at: string;
  sections_json?: any;
  notes?: string;
  synced: boolean;
  synced_at?: string;
  server_id?: string;
}

export interface OfflinePhoto {
  id?: number;
  inspection_id: string; // client_uuid
  file: File;
  synced: boolean;
  server_id?: string;
}

export interface SyncQueueItem {
  id?: number;
  entity_type: string;
  entity_id?: string;
  client_uuid: string;
  action: 'create' | 'update';
  payload_json: any;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  retry_count: number;
  error_message?: string;
}

class OfflineDatabase extends Dexie {
  inspections!: Table<OfflineInspection, number>;
  photos!: Table<OfflinePhoto, number>;
  syncQueue!: Table<SyncQueueItem, number>;

  constructor() {
    super('MyHiveDB');
    this.version(1).stores({
      inspections: '++id, client_uuid, hive_id, synced, started_at',
      photos: '++id, inspection_id, synced',
      syncQueue: '++id, client_uuid, status, entity_type',
    });
  }
}

export const db = new OfflineDatabase();

// Auto-save draft inspection
export async function saveInspectionDraft(data: Partial<OfflineInspection>): Promise<string> {
  const client_uuid = data.client_uuid || generateUUID();
  
  const existing = await db.inspections
    .where('client_uuid')
    .equals(client_uuid)
    .first();

  if (existing) {
    await db.inspections.update(existing.id!, {
      ...data,
      client_uuid,
      synced: false,
    });
  } else {
    await db.inspections.add({
      client_uuid,
      hive_id: data.hive_id!,
      started_at: data.started_at || new Date().toISOString(),
      offline_created_at: new Date().toISOString(),
      synced: false,
      ...data,
    });
  }

  return client_uuid;
}

// Queue inspection for sync
export async function queueInspectionForSync(client_uuid: string) {
  const inspection = await db.inspections
    .where('client_uuid')
    .equals(client_uuid)
    .first();

  if (!inspection) return;

  // Add to sync queue
  await db.syncQueue.add({
    entity_type: 'inspection',
    client_uuid,
    action: 'create',
    payload_json: {
      hive_id: inspection.hive_id,
      started_at: inspection.started_at,
      ended_at: inspection.ended_at,
      location_lat: inspection.location_lat,
      location_lng: inspection.location_lng,
      location_accuracy_m: inspection.location_accuracy_m,
      offline_created_at: inspection.offline_created_at,
      sections_json: inspection.sections_json,
      notes: inspection.notes,
      client_uuid: inspection.client_uuid,
    },
    status: 'pending',
    retry_count: 0,
  });
}

// Get pending sync items
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  return db.syncQueue
    .where('status')
    .anyOf(['pending', 'failed'])
    .toArray();
}

// Mark sync item as synced
export async function markSyncItemSynced(id: number, server_id?: string) {
  await db.syncQueue.update(id, {
    status: 'synced',
    error_message: undefined,
  });

  if (server_id) {
    // Update inspection with server_id
    const item = await db.syncQueue.get(id);
    if (item?.entity_type === 'inspection') {
      await db.inspections
        .where('client_uuid')
        .equals(item.client_uuid)
        .modify({ synced: true, server_id, synced_at: new Date().toISOString() });
    }
  }
}

// Mark sync item as failed
export async function markSyncItemFailed(id: number, error: string) {
  const item = await db.syncQueue.get(id);
  if (item) {
    await db.syncQueue.update(id, {
      status: 'failed',
      retry_count: item.retry_count + 1,
      error_message: error,
    });
  }
}

// Check if online
export function isOnline(): boolean {
  return navigator.onLine;
}

// Listen for online/offline events
export function onOnlineStatusChange(callback: (online: boolean) => void) {
  window.addEventListener('online', () => callback(true));
  window.addEventListener('offline', () => callback(false));
}
