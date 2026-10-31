# Public federation architecture (no HAYER-operated server)

## Non-negotiable deployment rule

HAYER must not require the user to buy, rent, configure, or maintain a VPS, server, database, domain, or API key. The user-facing portal is a static web app and can be published with GitHub Pages. Public service instances are operated by their independent communities and providers.

GitHub Actions is used only as a scheduled public-data collector and publisher. It runs on GitHub-hosted runners and writes a versioned `registry.json` into the repository. It is not a permanent HAYER application server and does not host user accounts, messages, uploads, or private data.

## Current automatic discovery adapters

| Network | Public source | Instance validation endpoint | What HAYER can do without an account |
|---|---|---|---|
| Matrix | [Public Matrix Homeserver List](https://servers.joinmatrix.org/servers.json) | `/_matrix/client/versions` | Discover homeservers and check client API availability; public rooms/content only where exposed |
| PeerTube | [PeerTube public instance index](https://instances.joinpeertube.org/api/v1/instances) | `/api/v1/config` | Discover instances and read public video/catalogue data |

The workflow refreshes the registry every six hours and can also be run manually. It deduplicates by protocol and host, uses HTTPS only, and refuses to replace the last known-good registry if every source fails.

## Integration limits that must be visible in the product

- A public instance list does not mean that registration is open. Registration is marked `unknown` until verified from the operator's own policy or registration endpoint.
- A public directory does not grant permission to create accounts, post, upload, send private messages, or administer an instance.
- Matrix accounts are homeserver-specific. Matrix discovery via `.well-known` helps clients find a homeserver for an existing Matrix ID; it does not make a HAYER ID a Matrix identity.
- Mastodon, Lemmy, PeerTube and Pixelfed users retain accounts on their chosen home instances unless the operator explicitly supports HAYER OIDC/OAuth or approved provisioning.
- OAuth requires an instance-specific client registration or a supported dynamic client registration flow, user consent, exact redirect URI handling, and token storage. A static page must never contain a client secret.
- Cross-origin browser restrictions can make an otherwise public endpoint unreadable to a static client. Such a result is `unknown`, not `down`. Do not introduce an untrusted public CORS proxy.
- Federation propagates public activities according to each operator's federation policy. It does not replicate private account databases or guarantee availability when a home instance disappears.

## Product behavior

1. HAYER loads the last published registry immediately.
2. The user can refresh the public catalogue; no server choice is required for browsing.
3. Each service adapter advertises exact capabilities: public read, federation, OAuth consent, or unsupported.
4. HAYER never asks for an external password and never creates accounts silently.
5. If an instance is unavailable, HAYER may recommend another compatible instance for a new account. It must not claim that the user's old account or private data has migrated.
6. A HAYER-wide identity can only be authoritative if a trusted identity provider exists. With the current no-server requirement, HAYER Pages cannot securely issue or recover accounts by itself. Until an external, user-approved identity provider is selected, HAYER ID is a profile/handle concept, not a working cross-network SSO credential.

## Implemented browser adapters

- Mastodon: the portal can read the selected instance public timeline through `GET /api/v1/timelines/public` when that instance permits browser CORS access.
- PeerTube: the portal can read public videos through `GET /api/v1/videos` when that instance permits browser CORS access.
- Matrix: the portal opens Element Web with the selected public homeserver for the user to continue through that operator's own sign-up/login flow.
- Mastodon, Lemmy, PeerTube and Pixelfed: the portal opens a discovered public instance; it only deep-links to known signup paths when the registry explicitly marks registration as open.

These are public, read-only discovery and launch integrations. They do not provide a HAYER account, cross-service identity, private messaging from inside the portal, uploads, or write permissions. Browser CORS failures are reported as unavailable rather than bypassed with a proxy.

## Planned next adapters

- Lemmy: consume the public Lemmyverse instance dataset and validate with `GET /api/v3/site`.
- Mastodon / Pixelfed: discover from a maintained public instance directory, then validate each candidate with `GET /api/v2/instance` (Mastodon) or a verified compatible public endpoint.
- XMPP, Discourse, Mobilizon and Nextcloud: only add public catalogues and adapters after their current discovery, CORS, auth and API policies are verified.

## Safety and operations

- Only HTTPS endpoints are accepted.
- All fetched JSON is treated as untrusted data and rendered as text, never HTML.
- No secrets, user credentials, private content, or tokens are committed to the registry.
- A directory listing is not a health check. The browser's explicit health check may report `unknown` when CORS or rate limits prevent verification.
- GitHub Actions failures leave the last successful registry intact.
- The project must not claim 100% uptime, universal SSO, or automatic migration between unrelated instances.
