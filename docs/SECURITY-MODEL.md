# HAYER security and trust model

HAYER must assume that public instances, volunteer storage nodes, registry feeds, and client devices can be unavailable, misconfigured, malicious, or compromised.

## Trust boundaries

| Component | Trust level | Allowed data |
|---|---|---|
| HAYER identity service | High, tightly controlled | Credentials, canonical account IDs, sessions, authorization policy |
| HAYER application services | High, least privilege | Only the data needed by each service |
| Public federated instances | Untrusted third parties | Only public data or data explicitly authorized through a scoped integration |
| HAYER storage agents | Untrusted for confidentiality | Encrypted chunks and signed metadata; no plaintext keys |
| Registry feeds | Untrusted input | Candidate URLs and claims pending validation |
| User devices | Variable | Session tokens and client-side encryption keys; support revocation |

## Identity rules

- HAYER ID is an immutable random identifier, not an email address.
- Do not expose internal database IDs in public URLs.
- Do not use the same secret/password on HAYER and third-party services.
- OAuth tokens are secrets: encrypt at rest, scope narrowly, rotate/revoke, and never log.
- Require PKCE S256, state and nonce validation, exact redirect URI matching, issuer/audience validation, and secure session cookies.
- Account recovery must not rely only on a publicly discoverable email address.

## Storage rules

- Encrypt files on the client before they leave the user's device.
- Use authenticated encryption with per-object data keys; wrap keys using a user's recovery-capable key hierarchy.
- Storage agents validate signed upload grants, quotas, chunk hashes, expiry, and object ownership proofs.
- Replicate across distinct operators and preferably distinct regions/providers.
- Repair missing replicas and verify restored plaintext hashes after decryption.
- Keep metadata minimal; avoid exposing filenames, user identity, or access patterns to storage nodes where practical.
- Publish retention and deletion semantics honestly.

## Node admission

A node is not trusted merely because it is public or listed in a directory. Require:
- proof of control of the endpoint or signed operator enrollment;
- software/version and capability declaration;
- HTTPS and valid certificate;
- abuse contact and acceptable-use policy;
- region and operator/failure-domain metadata;
- periodic health and integrity checks;
- quarantine and revocation path.

## Operational safeguards

- Separate production secrets from repository and CI logs.
- Use GitHub Actions OIDC or narrowly scoped short-lived credentials where supported; never commit long-lived tokens.
- Pin actions/dependencies and scan dependencies.
- Add security headers, CSP, input validation, output encoding, CSRF protection, and strict rate limits.
- Test node loss, malicious registry entries, stale snapshots, token theft/revocation, backup restore, and account deletion.
- Keep an incident-response and vulnerability-reporting process.

This document is a design baseline, not proof that the current static HAYER site already implements these controls.
