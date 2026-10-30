# Hayer: resilience and multi-server design

## Target

The directory must not depend on one instance, one directory provider, one hosting vendor, or one protocol. A 50% loss of a pool should reduce capacity, not take the portal offline, provided at least one compatible healthy instance remains and the user's account/data exist there.

## Important distinction: discovery redundancy vs service/data redundancy

Finding 1,000 public server URLs does not replicate user accounts, posts, files, rooms, or media. Each protocol has its own identity and federation model. The project must never promise seamless failover for a user's account unless the protocol and operator provide migration/replication.

- **Mastodon / Pixelfed:** accounts are hosted by a home instance. Federation copies public interactions to peers but does not automatically make a second writable home for the same account.
- **Matrix:** users belong to a homeserver. Federation allows cross-server rooms, but it is not a generic hot-standby replication mechanism for the user's account.
- **Lemmy / PeerTube / Mobilizon:** federation shares content and interactions, but local data and instance policy remain instance-specific.
- **Discourse / Nextcloud / Zulip:** these are not automatically one global federated network in the same way. Each hosted deployment may be isolated; identity, files, and backups need explicit support.

## Required architecture

1. **Multi-source discovery:** at least three independent public catalogs or protocol-native discovery methods per supported protocol where available.
2. **Immutable snapshots:** every registry refresh creates a versioned JSON snapshot. Never overwrite the last known good snapshot with an empty or malformed result.
3. **Validation and deduplication:** canonicalize hostnames, reject non-HTTP(S) URLs, remove duplicates, validate protocol identity and public policy metadata.
4. **Health monitoring:** use independent scheduled probes from more than one runner/location. Track healthy, degraded, unreachable, and unknown; CORS failures are unknown, not proof of outage.
5. **Circuit breaker:** temporarily avoid repeatedly failing nodes, with exponential backoff and a recovery probe.
6. **Selection:** prefer compatible, policy-approved, recently healthy nodes. Randomize among healthy nodes to avoid concentrating all users on one instance.
7. **Client cache:** keep the last known good registry and a cached portal shell. If a directory source is down, users can still browse the last snapshot.
8. **Multiple hosting mirrors:** publish the same static build to independent static hosts. DNS/domain failover is a separate concern and may not be free or instant.
9. **Protocol-aware routing:** never send a Matrix user to a Mastodon node or assume two servers of the same software can share an account.
10. **Data portability:** document account export, media export, backup, and migration per service. Where a service has no reliable export/import path, label that risk before registration.

## Failure model

If 5 of 10 nodes fail, a client can select from the remaining five only for new sessions or services whose protocol supports that operation. Existing accounts on failed homeservers may remain unavailable. Therefore the goal is graceful degradation and service continuity, not magical account continuity.

## Free-hosting constraints

The first phase uses static hosting and free public instances. Free tiers can sleep, throttle, change terms, or disappear. GitHub Pages, Cloudflare Pages, and similar providers are not a contractual high-availability cluster. A true multi-provider setup requires separate deployments, independent health checks, domain/DNS planning, and regular restore tests.

## Release gates

- No fake server counts or fabricated online states.
- Never mark a node down solely because browser CORS blocked a probe.
- Do not auto-register users on unknown third-party instances.
- Check age rules, privacy terms, moderation, backups, and registration availability before recommending an instance.
- Test with deliberately unavailable nodes and empty/bad source feeds.
