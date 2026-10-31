# HAYER Matrix SDK implementation

## Scope

This repository is evolving into a first-party Matrix client named HAYER. The user-facing account, profile, feed, chat and community experience remains HAYER-branded. Matrix homeservers are public third-party infrastructure; HAYER does not operate or rent a homeserver.

## Initial SDK foundation

- `src/matrix/client.js` is the shared Matrix SDK adapter.
- Homeserver discovery resolves `/.well-known/matrix/client`, then checks versions, login flows and registration availability.
- Password login uses the SDK's `loginRequest` API.
- Registration uses the SDK's `registerRequest` API and returns interactive-authentication challenges instead of directing users to Element.
- Authenticated clients initialize Rust Crypto where supported and start Matrix sync.
- HAYER application events are restricted to the `org.hayer.*` namespace.
- A single active SDK client is enforced because the SDK crypto store must not be opened by multiple clients simultaneously.

## Platform strategy

The first shared client is JavaScript/TypeScript so it can be used by the web application and wrapped for Android and desktop. The planned shells are:

- Web/PWA: Vite build and browser storage.
- Android: Capacitor shell, with native secure storage for refresh/access credentials.
- Windows and Linux: Tauri shell, with OS-backed credential storage.

The current static GitHub Pages application is not yet migrated to this adapter. Do not remove the existing REST implementation until the SDK-backed replacement has passed browser tests.

## Security requirements

- Never store passwords.
- Do not put access or refresh tokens in `localStorage`.
- Use IndexedDB for the browser crypto store and native secure storage on mobile/desktop.
- Initialize Rust Crypto before enabling encrypted room interactions.
- Clearly report when a homeserver or client cannot initialize E2EE; never label a room encrypted unless it is.
- Preserve recovery-key and cross-signing flows before enabling E2EE by default.
- Public homeserver operators control registration, quotas, retention, federation and availability.

## Remaining integration work

1. Wire the adapter into the existing login and registration UI.
2. Implement Matrix interactive-authentication UI for email, CAPTCHA and terms flows.
3. Replace raw REST polling with SDK sync and room timelines.
4. Migrate Feed, Chat, Groups, Communities, Profile and media operations to SDK methods.
5. Add a secure token vault abstraction for Web, Android, Windows and Linux.
6. Add encrypted media upload/download and recovery-key onboarding.
7. Add calls using compatible MatrixRTC infrastructure; public servers do not universally provide an SFU.
8. Build and package Android, Windows and Linux releases.
9. Run multi-user acceptance tests against at least two independent public homeservers.

## Validation

Run:

```sh
npm install
npm run check
npm test
python scripts/validate.py
```

The SDK adapter tests validate local input handling only. They do not prove that a public homeserver accepts registration, supports browser CORS, enables E2EE, or provides calls/media.
