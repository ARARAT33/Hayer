# HAYER public federation architecture

## Product boundary

HAYER is its own community. Feed and community posts are created through the HAYER client and represented by HAYER-specific Matrix event types. Third-party Mastodon, Pixelfed, Lemmy, PeerTube, or other users' posts are never imported into HAYER timelines.

External directories are used only to discover infrastructure providers and public server capabilities. Discovery metadata is not HAYER user-generated content.

## No Cloudflare backend

The HAYER-specific Cloudflare Worker hayer-api and D1 database hayer-core have been removed. The obsolete worker/index.js source has also been deleted. Do not recreate HAYER services on Cloudflare Workers, D1, KV, R2, Pages Functions, or Durable Objects. Other Cloudflare projects are out of scope and must remain untouched.

The frontend is static GitHub Pages. Authentication, rooms and messages are handled through public Matrix homeservers using the Matrix Client-Server API.

## Matrix implementation

- Default/recommended homeserver: converser.eu.
- Login and registration use Matrix password login and registration endpoints.
- Registration may require email, CAPTCHA, approval, or an operator-specific flow. HAYER does not bypass these controls; users may need to register through the operator's official site or Element first.
- HAYID is the full Matrix user ID, not a global HAYER-only namespace.
- The canonical shared HAYER Feed alias is #hayer-feed:converser.eu. The first member must create it while logged into converser.eu; later members can resolve and join it from federated homeservers.
- Feed posts, comments, reactions, community posts and room metadata use HAYER-specific Matrix event types.
- Direct messages and groups are Matrix rooms with explicit invitations.
- Public communities are discoverable through the current homeserver's public room directory. Private and secret communities use invite-only rooms; join requests are sent to the owner in a direct room.

## Storage and privacy

- The current client supports HTTPS media links, not a completed binary media upload workflow.
- Do not assume public servers accept anonymous uploads.
- E2EE is not implemented by this lightweight REST client. Matrix server operators may be able to access unencrypted room content.
- Voice/video call signaling, encrypted calls, file encryption, retention/deletion and storage failover are not yet implemented.
- Record actual media host and retention/deletion behavior before enabling uploads.
- Do not promise cross-server replication or failover unless the protocol and selected operators provide it and tests prove it.

## Acceptance gates

Before declaring production readiness, test with at least two independent accounts, preferably on different homeservers:
- account registration/login/logout and account recovery;
- HAYID lookup and profile discovery;
- shared HAYER Feed creation, joining, posting, search, reactions and comments;
- direct and group chat invitations and message sync;
- public/private/secret community access controls and owner approvals;
- media upload/download/deletion and client-side encryption;
- voice/video call negotiation and encryption;
- mobile browser reload/session persistence;
- server outage and alternate-server behavior.

## Current migration state

The static frontend no longer calls the deleted Cloudflare API. Matrix client integration now handles authentication, HAYID profile, Feed, direct/group rooms and community room flows. The Matrix versions endpoint on converser.eu returned HTTP 200 in a read-only check; the registration endpoint returned 405 to GET (expected for a POST endpoint). No real account was registered during that check. Full multi-user browser acceptance tests remain outstanding.
