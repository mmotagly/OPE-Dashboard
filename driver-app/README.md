# Driver companion app (GPS phase)

Android-only React Native + Expo app. Drivers sign in with a provisioned
account, see today's vehicle/shift assignment, and start/stop background
location tracking that feeds `/fleet-location` through the same pipeline
real GPS hardware uses. Camera streaming (LiveKit/WebRTC) is a later phase —
see the root `ROADMAP_NEXT.md`; nothing in this app touches it yet.

Not part of the Next.js app — separate `package.json`/`tsconfig.json`, its
own install/build/typecheck, excluded from the root app's lint/typecheck
the same way `bridge/` is.

## What's built vs. what's a config slot

Built and real: sign-in against Supabase Auth, the assignment fetch/choice
flow (`GET /api/driver/me/assignment`), the background location task with
its staged permission flow and bounded retry queue (`GET`/`POST` against
`/api/gps/driver/ping`), and the Android manifest config (foreground
service, background location, Android 14's `FOREGROUND_SERVICE_LOCATION`)
needed for background tracking to actually survive the app being minimized.

Config slots, empty until you fill them in: `.env` (below), the driver
accounts themselves (`drivers.auth_user_id` — provisioned manually per
migration `0021`'s header, no self-service sign-up), and the app icon/splash
assets (currently the template placeholders).

**Not yet tested on a real phone.** `npm run typecheck` and `npx
expo-doctor` are both clean, and the Expo config resolves without error,
but none of that proves the background service survives a real shift on a
real Android phone — OEM battery managers (Xiaomi/Huawei/Samsung/Oppo
especially) are known to kill background services that Android's own APIs
say should keep running. Field-testing on the actual phones drivers carry
is the real verification step, not a build check.

## Running it

Expo Go **will not work** — `expo-location`'s background task and (later)
`react-native-webrtc` both need native code Expo Go doesn't ship. Every run
here is against a custom **development build**.

```
cd driver-app
npm install
cp .env.example .env        # fill in Supabase URL/anon key + the API base URL
eas login                   # your own Expo account — not set up by this session
eas build --profile development --platform android
```

`eas build` prints a QR code / private link once it finishes — open it on
the driver's phone (with "install unknown apps" enabled), install it like
any sideloaded APK, no Play Store involved. Once that build is installed:

```
npm start                   # expo start --dev-client — connect the installed build to this
```

pushes JS/UI changes instantly. You only need a new `eas build` when a
*native* dependency changes (a new native module, or an `app.json`
permission/plugin change) — rare after this initial setup.

For a non-dev-client build closer to what a real internal test should look
like, use the `preview` profile instead:

```
eas build --profile preview --platform android
```

Both profiles are `distribution: internal` — signed APKs distributed via
EAS's own private link, never the Play Store.

## Permission flow, on purpose in this order

1. Foreground location (`requestForegroundPermissionsAsync`).
2. Background location (`requestBackgroundPermissionsAsync`) — Android
   11+ hands this to a system Settings screen ("Allow all the time"), not
   an in-app dialog. The app shows a plain-language reason before asking,
   since a bare permission prompt with no context reads as suspicious.
3. **Not automated**: exempting the app from battery optimization. That's
   not a permission API, it's a Settings deep link
   (`Linking.openSettings()`, wired up as the "Open app settings" button
   once step 2 is denied or tracking looks unreliable). Worth walking
   drivers through this by hand on whatever phone models they actually
   carry — see the field-testing note above.

## Env vars (`.env`, copy from `.env.example`)

| Var | What |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Same value as the web app's `NEXT_PUBLIC_SUPABASE_URL` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Same value as the web app's `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `EXPO_PUBLIC_API_BASE_URL` | The Vercel deployment's origin, no trailing slash |

All three are `EXPO_PUBLIC_*` — inlined at build time, safe to ship in the
APK the same way the web app's `NEXT_PUBLIC_*` vars are safe in its bundle
(the anon key is meant to be public; RLS is what actually gates data, and
this app's own routes never rely on RLS for the driver's session anyway —
see `src/lib/driver-auth.ts` in the main app).
