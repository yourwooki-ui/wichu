# Architecture

## Runtime

- Expo SDK 57, React Native, TypeScript, and Expo Router
- TanStack Query for server state and request caching
- Zustand for small, interaction-heavy client state such as the swipe deck
- Supabase Auth, PostgreSQL, Storage, Realtime, and RLS
- `expo-image` memory/disk cache and explicit prefetch
- i18next with Expo locale detection

## Boundaries

```text
app routes
  → feature screens/components
    → feature hooks and Zustand interaction state
      → feature services
        → Supabase client / future native providers
```

Routes remain thin. Feature code owns UI and behavior. Services isolate database, ads, purchases, notifications, and translation providers so those integrations can change without rewriting screens.

## Discover data flow

1. Fetch a batch from `get_discovery_candidates` through TanStack Query.
2. Render the first card and keep the next card already mounted.
3. Prefetch the first two photos for the next three profiles with `expo-image`.
4. Animate a swipe and remove the card from Zustand immediately.
5. Persist Like/Pass in the background; reconcile or surface an error if it fails.
6. Refill before the local deck reaches its low-water mark.

The current implementation completes steps 2–4 with mock profiles. Network persistence and background refill are the next integration step.

## Chat data flow

The planned chat mutation inserts an optimistic message into the TanStack Query cache, sends it through `chatService`, replaces the optimistic record with the server row, and receives peer messages through a match-scoped Realtime channel.

## Environment

Copy `.env.example` to `.env.local` and set only the Expo-public Supabase URL and publishable key. A `service_role` or secret key must never be placed in the app.
