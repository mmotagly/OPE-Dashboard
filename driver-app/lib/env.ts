/**
 * `EXPO_PUBLIC_*` vars are inlined at build time by Expo — same "safe to
 * ship" reasoning as the web app's `NEXT_PUBLIC_*` ones: the anon key is
 * meant to be public (RLS is what actually gates access), and the API base
 * URL is just the Vercel deployment's own origin. Read once, fail loudly at
 * startup rather than deep inside a Supabase call with a confusing error.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name} — copy .env.example to .env and fill it in before running the app.`,
    );
  }
  return value;
}

export const SUPABASE_URL = required(
  "EXPO_PUBLIC_SUPABASE_URL",
  process.env.EXPO_PUBLIC_SUPABASE_URL,
);
export const SUPABASE_ANON_KEY = required(
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);
export const API_BASE_URL = required(
  "EXPO_PUBLIC_API_BASE_URL",
  process.env.EXPO_PUBLIC_API_BASE_URL,
);

// Non-secret, safe to leave in — the fastest way to confirm the running
// bundle actually has today's .env values baked in, not a stale Metro
// cache from before an edit (EXPO_PUBLIC_* is inlined at transform time,
// per dev-server process, not re-read on a plain app reload).
console.log("[env] SUPABASE_URL =", SUPABASE_URL);
console.log("[env] API_BASE_URL =", API_BASE_URL);
