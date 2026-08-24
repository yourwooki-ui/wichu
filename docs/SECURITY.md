# WICHU Security Baseline

## Protection model

WICHU assumes that a mobile binary, browser bundle, publishable Supabase key, and
all client requests can be inspected or modified. Client-side checks improve UX
only. PostgreSQL constraints, RLS, restricted RPCs, private schemas, and Edge
Function authentication are the authorization boundary.

The goal is containment: a stolen user session may act only as that user, a
publishable key grants no private data by itself, and server secrets never enter
the app bundle.

## Data handling

- Passwords are handled by Supabase Auth as one-way password verifiers. WICHU
  never stores, encrypts, logs, or decrypts user passwords.
- Native access and refresh tokens are stored through `expo-secure-store`, using
  Android Keystore-backed encryption and iOS Keychain. Existing AsyncStorage
  sessions migrate on first read and are deleted from AsyncStorage.
- OAuth uses authorization code + PKCE. Access and refresh tokens are not
  accepted from URL fragments.
- Exact coordinates live in `private.profile_locations`; clients receive only a
  rounded distance through controlled database functions.
- Exact birth dates remain available only to the member's self-only RPC and
  trusted server/admin workflows. Other profile, discovery, match, like, and
  visitor read models return an integer age, and the client role has no direct
  `birth_date` column privilege.
- Push tokens cannot be hashed because the delivery provider needs the original
  value. They are therefore hidden from direct Data API access and are managed
  only through authenticated registration/removal RPCs and server workers.
- DeepL, Expo push, Supabase secret/service-role, signing, Vercel, and future IAP
  verification keys are server-only secrets. They must never use an
  `EXPO_PUBLIC_` prefix.
- Message bodies must remain decryptable for chat and translation. Current
  protection is TLS, Supabase encryption at rest, match-only RLS, block checks,
  and server-side translation authorization. End-to-end encryption is a separate
  product decision because it conflicts with server translation and moderation.

## Security boundaries

- `anon` has no application table access.
- Every client-facing table uses RLS and explicit grants.
- Internal tables and exact locations are isolated in the unexposed `private`
  schema. Default privileges deny future private objects to client roles.
- `SECURITY DEFINER` functions use an empty `search_path`, validate `auth.uid()`,
  and have explicit execute grants.
- Profile photos use a private Storage bucket and short-lived signed URLs.
- Edge Functions validate their caller (`user` or server `secret`), method, and
  request size before using the service-role client.
- The web preview denies framing, MIME sniffing, unnecessary microphone access,
  and unapproved script/connect/image origins through response headers and CSP.

## Key lifecycle

1. Store server secrets in Supabase Edge Function secrets, EAS environment
   secrets, GitHub Actions secrets, or Vercel encrypted environment variables.
2. Use a modern Supabase publishable key in the app. `src/lib/supabase-config.ts`
   rejects new secret keys and legacy `service_role` JWTs.
3. Rotate a key immediately if it appears in source, logs, screenshots, support
   tickets, or chat. Remove it from the provider first, then replace dependent
   deployments. Deleting it from Git history alone does not revoke it.
4. After rotating a JWT signing key or suspecting session theft, revoke affected
   sessions and verify Auth audit logs.
5. Never print secret values during CI or incident review. Report only the key
   name, provider, last rotation time, and affected deployment.

## CI and release gates

- `npm run security:check` rejects tracked private keys, Supabase secret keys,
  legacy service-role JWTs, and secret-like `EXPO_PUBLIC_` variable names.
- `npm run verify` includes the security check, TypeScript, ESLint, and tests.
- CI resets an isolated Supabase database, lints functions, and runs the RLS
  contract suite before deploying the web build.
- Run `npm audit --omit=dev`, `npx expo-doctor`, linked Supabase DB lint, and the
  Supabase Security Advisor before each store release.
- The current high-severity Metro/image parser finding is fixed by pinning the
  Expo-compatible Metro 0.84.5 patch. Remaining npm findings are moderate,
  build-time Expo/Xcode tooling findings; do not accept npm's suggested Expo 46
  downgrade. Recheck them when Expo 57 publishes an upstream config-plugin fix.

## Incident response

1. Contain: disable the exposed key/function, revoke sessions, and block the
   affected deployment or route.
2. Preserve: record timestamps, request IDs, Auth/API/Database/Edge/Storage logs,
   and affected user IDs without copying message bodies or tokens.
3. Scope: determine whether the incident is publishable-key abuse, a user-session
   takeover, server-secret exposure, admin-account compromise, or database access.
4. Eradicate: rotate credentials, patch the authorization path, redeploy, and run
   RLS contracts plus Supabase advisors.
5. Recover: re-enable the smallest required surface and monitor error/auth/rate
   anomalies.
6. Notify: follow applicable privacy, platform, law-enforcement, and user notice
   requirements. Child-safety escalation follows the separate operations policy.

## Remaining production controls

- Enable leaked-password protection, CAPTCHA/bot protection, and MFA for all
  master/operator accounts in the Supabase dashboard.
- Restrict direct database network access to operator/VPN addresses when the plan
  supports Network Restrictions. This does not replace Data API RLS.
- Configure log drains/alerts for repeated auth failures, RLS denials, abnormal
  message/swipe volume, admin actions, and Edge Function 401/403/429/5xx spikes.
- Add provider-signed webhook verification and idempotency before enabling IAP,
  AdMob rewards, or subscription entitlement writes.
- Remove the temporary review-sample production flag before public launch.
