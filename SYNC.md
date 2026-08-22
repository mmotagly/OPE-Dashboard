# Working across two machines

This project is developed from two machines (desktop + laptop). There is no
CI/deploy step that catches drift between them, so follow this checklist at
the start of every session, on whichever machine you're on.

## Every session, in order

1. **Pull.**
   ```
   git pull
   ```
   Resolve any conflicts before doing anything else. Do not stash away and
   forget — if you had uncommitted work, `git status` after the pull and
   reconcile it.

2. **Check `package.json` for dependency changes.**
   Compare against what's installed:
   ```
   npm ls --depth=0
   ```
   If `package.json` or `package-lock.json` changed since last session (check
   `git log -1 --stat -- package.json package-lock.json`), run:
   ```
   npm install
   ```

3. **Verify `.env.local` exists and has all required keys.**
   `.env.local` is gitignored and never synced by git — it must be copied or
   re-created by hand on each machine. Required keys:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only — never expose to the client)

   If any are missing, pull them from the Supabase project settings — do not
   invent placeholder values and do not commit real values to the repo.

4. **Start the dev server.**
   ```
   npm run dev
   ```
   Confirm it reaches "Ready" with no missing-env errors before starting work.

## Before switching machines / ending a session

- Commit and push anything you want available on the other machine. Nothing
  uncommitted travels between machines.
- `.env.local` itself never travels via git — if it changed (e.g. rotated
  Supabase keys), update it by hand on the other machine too.
- If you ran a new migration in `supabase/migrations/`, note that schema
  changes apply to the shared Supabase project immediately regardless of
  which machine ran them — the other machine just needs the migration file
  via `git pull`, not a separate DB step.
