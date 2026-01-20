import { api } from './api';
import {
  getPendingSyncItems,
  markSyncItemSynced,
  markSyncItemFailed,
  isOnline,
  onOnlineStatusChange,
} from './offlineDb';

let syncInProgress = false;

export async function syncOfflineData() {
  if (syncInProgress || !isOnline()) {
    return;
  }

  syncInProgress = true;

  try {
    const pendingItems = await getPendingSyncItems();

    if (pendingItems.length === 0) {
      return;
    }

    // Mark items as syncing
    const itemsToSync = pendingItems
      .filter((item) => item.retry_count < 3) // Max 3 retries
      .map((item) => ({
        entity_type: item.entity_type,
        entity_id: item.entity_id,
        client_uuid: item.client_uuid,
        action: item.action,
        payload_json: item.payload_json,
      }));

    if (itemsToSync.length === 0) {
      return;
    }

    const response = await api.post('/sync/queue', { items: itemsToSync });

    // Process results
    for (let i = 0; i < itemsToSync.length; i++) {
      const result = response.data.results[i];
      const item = pendingItems[i];

      if (result.status === 'synced') {
        await markSyncItemSynced(item.id!, result.server_id);
      } else if (result.status === 'failed') {
        await markSyncItemFailed(item.id!, result.error || 'Sync failed');
      } else if (result.status === 'duplicate') {
        // Already synced
        await markSyncItemSynced(item.id!, result.server_id);
      }
    }
  } catch (error: any) {
    console.error('Sync failed:', error);
    // Don't mark as failed here - let retry logic handle it
  } finally {
    syncInProgress = false;
  }
}

// Auto-sync when online
export function startAutoSync() {
  // Sync immediately if online
  if (isOnline()) {
    syncOfflineData();
  }

  // Listen for online status
  onOnlineStatusChange((online) => {
    if (online) {
      syncOfflineData();
    }
  });

  // Periodic sync every 30 seconds when online
  setInterval(() => {
    if (isOnline()) {
      syncOfflineData();
    }
  }, 30000);
}
