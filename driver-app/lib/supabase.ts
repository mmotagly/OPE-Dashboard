import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./env";

/**
 * Same Supabase Auth this driver signs into as the web app's staff accounts
 * — auth is shared, data access is not. A driver's session satisfies none
 * of the RLS policies in 0001_init.sql (no profiles row, no app_role,
 * deliberately — see migration 0021's header), so this client is only ever
 * used for sign-in/sign-out and to read the current session's access token.
 * All actual data — today's assignment, GPS pings — goes through
 * lib/api.ts's calls to the Next.js app, never a direct table query from
 * here.
 */

// expo-secure-store has a ~2KB per-key limit; a Supabase session (access +
// refresh token) fits comfortably, but this is why it's not just AsyncStorage
// wrapped for something that could grow — auth tokens are the one thing here
// worth the OS keychain/keystore instead of plain storage.
const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
