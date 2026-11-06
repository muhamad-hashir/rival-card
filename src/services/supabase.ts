// src/services/supabase.ts - Supabase Client Configuration & Multiplayer Exports
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Standalone release APKs do not bundle .env files by default unless explicitly inlined.
// Fallback values prevent instant fatal crashes during module evaluation.
const FALLBACK_SUPABASE_URL = 'https://diprmtxrlynniqacapmz.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'sb_publishable_aejGXlQ3gcemdzCdVBt99Q_WBtxUoYQ';

const rawUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const rawKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

const SUPABASE_URL = rawUrl && rawUrl.startsWith('http') ? rawUrl : FALLBACK_SUPABASE_URL;
const SUPABASE_ANON_KEY = rawKey && rawKey.length > 0 ? rawKey : FALLBACK_SUPABASE_ANON_KEY;

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

let supabaseClient: SupabaseClient;
try {
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
} catch (err) {
  console.warn('[Supabase] Failed to initialize configured client, creating fallback client:', err);
  supabaseClient = createClient(FALLBACK_SUPABASE_URL, FALLBACK_SUPABASE_ANON_KEY, {
    auth: {
      storage: safeStorage,
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export const supabase: SupabaseClient = supabaseClient;

export * from './multiplayerService';
