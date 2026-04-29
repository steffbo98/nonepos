import { useEffect, useState } from 'react';
import { collection as firestoreCollection, doc as firestoreDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db as firestoreDb } from './firebase';
import { DataService } from './dataService';

export interface SyncStatus {
  lastSync: Date | null;
  pendingChanges: number;
  isOnline: boolean;
  syncing: boolean;
  error: string | null;
}

const dataService = new DataService();

class CloudSyncManager {
  private status: SyncStatus = {
    lastSync: null,
    pendingChanges: 0,
    isOnline: navigator.onLine,
    syncing: false,
    error: null
  };

  private listeners = new Set<(status: SyncStatus) => void>();
  private intervalId: number | null = null;
  private syncCollections = [
    'products',
    'orders',
    'customers',
    'settings',
    'expenses',
    'suppliers',
    'purchase_orders',
    'customer_ledger',
    'stock_movements'
  ];

  constructor() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  getStatus() {
    return this.status;
  }

  subscribe(listener: (status: SyncStatus) => void) {
    listener(this.status);
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private broadcast() {
    for (const listener of this.listeners) {
      listener({ ...this.status });
    }
  }

  private handleOnline() {
    this.status.isOnline = true;
    this.status.error = null;
    this.broadcast();
    this.syncOnce();
  }

  private handleOffline() {
    this.status.isOnline = false;
    this.broadcast();
  }

  async start(pollIntervalMs = 30000) {
    if (this.intervalId) {
      return;
    }

    await this.syncOnce();
    this.intervalId = window.setInterval(() => {
      void this.syncOnce();
    }, pollIntervalMs);
  }

  stop() {
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async forceSync() {
    await this.syncOnce();
  }

  private async syncOnce() {
    this.status.isOnline = navigator.onLine;
    if (!this.status.isOnline) {
      this.broadcast();
      return;
    }

    this.status.syncing = true;
    this.status.error = null;
    this.broadcast();

    try {
      await this.uploadPendingChanges();
      await this.pullRemoteChanges();
      this.status.lastSync = new Date();
    } catch (error) {
      this.status.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.status.syncing = false;
      this.broadcast();
    }
  }

  private async getStoreId(): Promise<string> {
    try {
      const storeSetting = await dataService.getSetting('storeId');
      if (storeSetting?.value) {
        try {
          return JSON.parse(storeSetting.value);
        } catch {
          return storeSetting.value;
        }
      }
      return 'default-store';
    } catch {
      return 'default-store';
    }
  }

  private parsePayload(payload: string | any) {
    if (typeof payload !== 'string') {
      return payload;
    }

    try {
      return JSON.parse(payload);
    } catch {
      return payload;
    }
  }

  private async uploadPendingChanges() {
    const queue = await dataService.listSyncQueue();
    this.status.pendingChanges = queue.length;
    this.broadcast();

    if (!queue.length) {
      return;
    }

    const storeId = await this.getStoreId();

    for (const item of queue) {
      try {
        const payload = this.parsePayload(item.payload);
        const targetDoc = firestoreDoc(firestoreDb, 'stores', storeId, item.collection, item.entityId);

        if (item.operation === 'delete') {
          await deleteDoc(targetDoc);
        } else {
          await setDoc(targetDoc, {
            ...payload,
            id: item.entityId,
            updatedAt: payload.updatedAt || new Date().toISOString()
          });
        }

        await dataService.markSyncQueueComplete(item.id);
      } catch (error) {
        await dataService.markSyncQueueFailed(item.id, error instanceof Error ? error.message : String(error));
      }
    }

    const remainingQueue = await dataService.listSyncQueue();
    this.status.pendingChanges = remainingQueue.length;
    this.broadcast();
  }

  private async pullRemoteChanges() {
    const storeId = await this.getStoreId();

    for (const collectionName of this.syncCollections) {
      const remoteCollection = firestoreCollection(firestoreDb, 'stores', storeId, collectionName);
      const snapshot = await getDocs(remoteCollection);

      for (const docSnapshot of snapshot.docs) {
        const remoteData = docSnapshot.data() as any;
        const item = {
          ...remoteData,
          id: remoteData.id || docSnapshot.id,
          updatedAt: remoteData.updatedAt || new Date().toISOString()
        };

        await dataService.applyRemoteChange(collectionName, item, 'update');
      }
    }
  }
}

const syncManager = new CloudSyncManager();

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>(syncManager.getStatus());

  useEffect(() => {
    const unsubscribe = syncManager.subscribe(setStatus);
    return () => unsubscribe();
  }, []);

  return status;
}

export function startCloudSync() {
  void syncManager.start();
}

export function stopCloudSync() {
  syncManager.stop();
}

export function forceCloudSync() {
  void syncManager.forceSync();
}
