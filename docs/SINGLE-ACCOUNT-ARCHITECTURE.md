# HAYER single-account and distributed data architecture

## Product rule

A person creates exactly one account at HAYER. HAYER owns the user-facing identity, profile, permissions, settings, recovery flow, and account lifecycle. The person must not be forced to create a separate visible account on Mastodon, Matrix, Lemmy, PeerTube, or another external platform just to use HAYER.

This is a product goal, not a capability that can be imposed on arbitrary public servers. Third-party operators control their servers, registration rules, APIs, retention, moderation, and availability.

## Four distinct layers

### 1. HAYER Identity Provider (IdP)

- One canonical HAYER subject ID (opaque, immutable, never derived from email or username).
- HAYER username/handle is unique inside HAYER; display name can change.
- OIDC authorization-code flow with PKCE for HAYER first-party apps and compatible services.
- Passkeys/WebAuthn preferred; optional TOTP and recovery codes; rate limits and risk-based challenges.
- Short-lived access tokens, rotating refresh tokens, revocation, device/session management.
- MFA/recovery and account deletion are owned by HAYER, not delegated to a random public instance.
- Never reuse a user's HAYER password on an external service.

### 2. Service integration gateway

Each platform is connected through a typed adapter. The adapter declares what is actually supported:

- `hayer_sso`: external service trusts HAYER OIDC/SAML/LDAP. This can provide one-click sign-in without a second password, if the operator explicitly configures it.
- `oauth_consent`: user authorizes HAYER to access an existing external account. This is not the same as creating an account and may require a one-time consent screen.
- `managed_provisioning`: HAYER provisions a service account through an operator-approved API or a HAYER-managed deployment. Must be explicitly enabled by the operator.
- `federated_public`: public content and interactions can be viewed across federation, but account ownership remains on the user's home server.
- `unsupported`: no automatic account creation or write access. HAYER may link out or show public content only.

Never silently create accounts on arbitrary public servers, scrape private data, bypass registration rules, or store third-party passwords. Request minimum OAuth scopes and show the operator/domain and requested permissions before consent.

### 3. HAYER data plane

HAYER-owned data (profile, preferences, app metadata, HAYER posts/messages where supported) must use a HAYER-defined data model and stable object IDs. The authoritative identity and access-control records remain under HAYER governance.

For user files and large blobs, use a separate storage-node protocol rather than pretending every Mastodon/Matrix/Lemmy server is generic file storage:

- Volunteer or partner nodes run a HAYER Storage Agent and explicitly opt in.
- Client-side encryption before upload; storage nodes receive ciphertext, object ID, size, hash, expiry/retention class, and placement metadata only.
- Split data into independently verifiable chunks and place copies across failure-independent operators/regions. Start with 3 replicas on 3 distinct operators; never count 3 machines from one operator as 3 independent failure domains.
- Use signed receipts, content hashes, periodic repair, quota accounting, and a last-known-good placement map.
- For larger scale, evaluate erasure coding only after restore and repair tests prove it is safe.
- Deletion uses signed tombstones and a bounded propagation window; document that backups and offline nodes may retain encrypted copies until their retention window expires.
- A storage node is not trusted with plaintext or identity credentials. Compromised nodes must be revocable and replaceable.

A generic public instance cannot be used as a HAYER storage node unless it exposes an explicit, documented, authorized storage API or runs the HAYER agent.

### 4. Discovery, health, and routing

- Maintain a multi-source registry of candidate nodes by protocol and capability.
- Verify ownership/operator policy, registration status, supported protocol version, data location, retention, age rules, moderation policy, and security contact where available.
- Probe from independent scheduled runners. Distinguish `healthy`, `degraded`, `unreachable`, and `unknown`; CORS/rate-limit failures are unknown.
- Select only nodes that match the required adapter and capability. Do not route a Matrix request to a Mastodon server or treat a read-only public node as writable storage.
- Keep signed, versioned registry snapshots and the last-known-good snapshot on multiple independent static hosts.

## What happens when servers fail?

Discovery redundancy is not data redundancy. If 5 of 10 public instances fail, HAYER can route new sessions to compatible healthy instances. It cannot promise that an account hosted on one failed instance will automatically appear on another.

For HAYER storage-agent nodes, replication can preserve encrypted file availability if enough independent replicas remain. With 3 replicas, loss of 1 or 2 nodes can still leave a copy, but writes/repair may pause depending on quorum policy. For critical metadata, use a separate replicated database service with tested backups and restore drills; static hosting alone cannot provide account registration or transactional writes.

## Security baseline (release blockers)

1. Threat model and data classification before collecting personal data.
2. TLS everywhere; secure cookies; CSRF protection; strict CORS; CSP; HSTS.
3. Argon2id password hashing if passwords are supported; passkeys preferred; never plaintext passwords.
4. OIDC state, nonce, PKCE S256, exact redirect URI allowlists, token audience/issuer validation.
5. Encrypt sensitive data at rest; client-side encryption for user file content; keys separated from storage.
6. Least-privilege service tokens, secret rotation, revocation, no secrets in frontend bundles or logs.
7. Per-account, per-IP, and per-node rate limits; abuse detection; anti-enumeration responses.
8. Signed node identity and software updates; node quarantine/revocation; dependency and supply-chain scanning.
9. Audit events for administrative actions without logging message/file contents or credentials.
10. Backup, restore, key recovery, deletion, incident response, penetration testing, and disaster-recovery exercises.
11. Independent security review before production launch. No claim of “100% secure” or “100% uptime”.

## Build order

1. Define HAYER identity and account database/API contract.
2. Build OIDC IdP and first-party session/security layer.
3. Build adapter interface and capability registry; first adapter should target a HAYER-managed Matrix deployment or another service with verified SSO support.
4. Build HAYER Storage Agent protocol and a local development node; test encryption, replication, node loss, and restore.
5. Add public-instance discovery as optional integrations, never as the identity authority.
6. Add operator console, consent UI, audit, monitoring, and multi-host registry mirrors.
7. Only then onboard real users and production data.

## Non-goals

- No universal account creation on arbitrary public instances.
- No claim that federation automatically replicates private accounts or files.
- No plaintext storage of user files on volunteer nodes.
- No dependence on a single directory, runner, hosting vendor, or public instance.
- No production-readiness claim until live end-to-end, failure, security, and restore tests pass.
