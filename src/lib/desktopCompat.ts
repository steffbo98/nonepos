import { useEffect, useState } from 'react';

export const db = {};
export const storage = {};

export const auth = {
  currentUser: {
    uid: 'admin-001',
    email: 'admin@nonepos.local',
  },
};

export enum OperationType {
  GET = 'GET',
  LIST = 'LIST',
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  WRITE = 'WRITE',
  DELETE = 'DELETE',
}

type SnapshotDoc = {
  id: string;
  data: () => Record<string, unknown>;
};

export function useSyncStatus() {
  const [status, setStatus] = useState({
    isOnline: navigator.onLine,
    pendingChanges: 0,
    lastSync: new Date(),
    conflicts: [] as unknown[],
  });

  useEffect(() => {
    const update = () => {
      setStatus((current) => ({
        ...current,
        isOnline: navigator.onLine,
        lastSync: new Date(),
      }));
    };

    window.addEventListener('online', update);
    window.addEventListener('offline', update);

    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return status;
}

export function collection(_database: unknown, ...pathSegments: string[]) {
  return { path: pathSegments.join('/') };
}

export function doc(_database: unknown, ...pathSegments: string[]) {
  return { path: pathSegments.join('/') };
}

export function query(reference: unknown, ..._constraints: unknown[]) {
  return reference;
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return { field, direction };
}

export function limit(count: number) {
  return { count };
}

export function onSnapshot(
  _reference: unknown,
  onNext: (snapshot: { docs: SnapshotDoc[] }) => void,
  _onError?: (error: unknown) => void
) {
  window.setTimeout(() => onNext({ docs: [] }), 0);
  return () => {};
}

export async function addDoc(_reference: unknown, data: Record<string, unknown>) {
  return { id: crypto.randomUUID(), data };
}

export async function updateDoc(_reference: unknown, _data: Record<string, unknown>) {
  return;
}

export async function setDoc(_reference: unknown, _data: Record<string, unknown>) {
  return;
}

export async function deleteDoc(_reference: unknown) {
  return;
}

export async function getDoc(_reference: unknown) {
  return {
    exists: () => false,
    data: (): Record<string, any> => ({}),
  };
}

export function serverTimestamp() {
  return new Date().toISOString();
}

export function ref(_storage: unknown, path: string) {
  return { path };
}

export async function uploadBytes(reference: unknown, _file: File) {
  return { ref: reference };
}

export async function getDownloadURL(reference: { path?: string } | unknown) {
  if (reference && typeof reference === 'object' && 'path' in reference) {
    return String(reference.path || '');
  }

  return '';
}

export class GoogleAuthProvider {}

export async function signInWithPopup(_auth?: unknown, _provider?: unknown) {
  return { user: auth.currentUser };
}

export function handleFirestoreError(error: unknown, operation: OperationType, path: string) {
  console.warn(`Desktop fallback handled ${operation} for ${path}:`, error);
}
