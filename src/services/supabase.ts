// src/services/supabase.ts - Supabase Client Configuration & Multiplayer Exports
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://diprmtxrlynniqacapmz.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_aejGXlQ3gcemdzCdVBt99Q_WBtxUoYQ';

// Safe Storage Adapter with automatic graceful fallback to memoryStore
// if native AsyncStorage module is null or throws (e.g. inside Expo Go / web).
const memoryStore = new Map<string, string>();
let nativeAsyncStorageFailed = false;

let NativeAsyncStorage: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('@react-native-async-storage/async-storage');
  NativeAsyncStorage = mod?.default ?? mod;
} catch {
  nativeAsyncStorageFailed = true;
}

export const safeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (!nativeAsyncStorageFailed && NativeAsyncStorage && typeof NativeAsyncStorage.getItem === 'function') {
      try {
        const val = await NativeAsyncStorage.getItem(key).catch(() => {
          nativeAsyncStorageFailed = true;
          return null;
        });
        if (val !== null && val !== undefined) {
          return val;
        }
      } catch {
        nativeAsyncStorageFailed = true;
      }
    }
    return memoryStore.get(key) ?? null;
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (!nativeAsyncStorageFailed && NativeAsyncStorage && typeof NativeAsyncStorage.setItem === 'function') {
      try {
        await NativeAsyncStorage.setItem(key, value).catch(() => {
          nativeAsyncStorageFailed = true;
        });
      } catch {
        nativeAsyncStorageFailed = true;
      }
    }
    memoryStore.set(key, value);
  },

  removeItem: async (key: string): Promise<void> => {
    if (!nativeAsyncStorageFailed && NativeAsyncStorage && typeof NativeAsyncStorage.removeItem === 'function') {
      try {
        await NativeAsyncStorage.removeItem(key).catch(() => {
          nativeAsyncStorageFailed = true;
        });
      } catch {
        nativeAsyncStorageFailed = true;
      }
    }
    memoryStore.delete(key);
  },
};

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: safeStorage,
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export * from './multiplayerService';
