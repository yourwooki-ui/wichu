@AGENTS.md

# WICHU working agreement

Claude may inspect, edit, run, and verify this repository directly. Work toward a
production-ready native Expo application, not a disposable prototype.

## Before changing code

- Read the current working tree and preserve every unrelated or concurrent change.
- Never reset, revert, overwrite, or delete existing work just to make a task easier.
- For Expo APIs or configuration, follow the exact Expo 57 documentation required by
  `AGENTS.md`.
- Prefer the smallest maintainable change that satisfies the requested scope.

## Product and implementation rules

- Korean is the current primary UI language; retain the existing i18n structure.
- Keep the WICHU visual system light, polished, youthful, and globally usable.
- Use the established feature folders, theme tokens, shared components, query layer,
  stores, and service boundaries instead of duplicating implementations.
- Preserve native iOS and Android behavior. Web is a development preview and must not
  become the product architecture.
- Keep discovery responsive: prepared cards, image prefetch, optimistic interactions,
  and background refill must remain intact.
- Database changes must be migration-based and preserve Supabase RLS. Never bypass RLS
  from client code.
- Do not add feeds, stories, communities, video calls, speculative AI features, or
  other unrequested product scope.

## Verification and visual QA

- Run `npm run verify` after code changes.
- Run `npx prettier --check` on changed configuration or documentation files.
- For UI work, use the existing `.claude/launch.json` web preview on port 8081 and
  inspect the actual rendered screen at a phone-like viewport.
- Report anything that could only be validated on a physical iOS or Android device.

## Credentials and external actions

- Environment variables and authenticated CLIs may be used when required, but never
  print, paste, commit, or expose passwords, access tokens, service-role keys, or local
  environment file contents.
- Commit, push, deploy, publish, send messages, or mutate production services only when
  the user has requested that external action in the active task.
- Before a destructive or difficult-to-recover action, resolve and verify the exact
  target first.
