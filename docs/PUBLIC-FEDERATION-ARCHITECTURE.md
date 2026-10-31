# HAYER public federation architecture

## Product boundary

HAYER is its own community. Its Feed, search, media discovery, and community views contain only posts authored by HAYER members. Third-party Mastodon, Pixelfed, Lemmy, PeerTube, or other users' content must never be imported into HAYER timelines.

External directories may be used only to discover infrastructure providers and public server capabilities. Discovery metadata is not HAYER user-generated content.

## No Cloudflare backend

The HAYER-specific Cloudflare Worker `hayer-api` and D1 database `hayer-core` have been removed. Do not recreate HAYER services on Cloudflare Workers, D1, KV, R2, Pages Functions, or Durable Objects. Other Cloudflare projects are out of scope and must remain untouched.

The frontend is static GitHub Pages. A static frontend alone cannot provide global accounts, shared posts, private messaging, cross-device sync, or durable media. These capabilities require federation with existing public servers.

## Candidate federation layer

Matrix is the leading candidate for identity, direct/group messaging, rooms, and media because its Client-Server API supports browser clients and federated homeservers. Use only servers that explicitly permit the required registration and API access. Server selection must be transparent and users must be shown the operator's terms, jurisdiction, retention policy, media limits, and registration requirements.

A Matrix ID includes its homeserver and is not a globally unique HAYER-only username. HAYID must therefore be defined honestly (for example, the full Matrix ID plus a HAYER profile record). Global account discovery must not be claimed unless a reliable federated directory is implemented.

## Storage and privacy

- Upload files only to a public service whose operator/API explicitly permits the operation.
- Do not assume public servers accept anonymous uploads.
- Encrypt private attachments on the client before upload; public homeservers otherwise can access unencrypted media.
- Record the actual media host and retention/deletion behavior.
- Do not promise cross-server replication or failover unless the protocol and selected operators provide it and tests prove it.

## Acceptance gates

No feature is marked complete until tested with at least two independent accounts, preferably on different homeservers:
- account creation/login/logout and account recovery;
- HAYID lookup and profile discovery;
- HAYER-only feed, reactions, comments, and search;
- direct and group chat;
- public/private/secret community access controls;
- media upload/download and deletion;
- voice/video call negotiation and encryption;
- mobile browser reload/session persistence;
- server outage and alternate-server behavior.

## Current migration state

Cloudflare removal is complete. The old Worker-backed API calls in the frontend still require replacement; until that work and real-server tests are complete, account, feed, chat, and community backend functionality must not be described as operational.
