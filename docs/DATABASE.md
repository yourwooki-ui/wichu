# Database

The schema is migration-managed in `supabase/migrations`. The initial migration is intentionally self-contained and should be reviewed in a Supabase preview/local database before production use.

## Tables

| Table               | Purpose                      | Key invariant                                |
| ------------------- | ---------------------------- | -------------------------------------------- |
| `profiles`          | Public discovery profile     | Auth user ID is the primary key; 18+ trigger |
| `profile_photos`    | Ordered Storage paths        | Position is unique and limited to 1–6        |
| `interests`         | Controlled interest catalog  | Unique slug                                  |
| `profile_interests` | Profile/interest join        | Composite primary key                        |
| `swipes`            | Like or Pass                 | Unique swiper/target pair; no self-swipe     |
| `matches`           | Mutual-like relationship     | Canonical ordered user pair is unique        |
| `messages`          | Match chat messages          | Sender must be an active match participant   |
| `blocks`            | Directional blocks           | Unique blocker/blocked pair                  |
| `reports`           | Safety reports               | Reporter can only create/read their reports  |
| `user_settings`     | Private filters/preferences  | Owner-only access                            |
| `subscriptions`     | Server-managed Ad-Free state | Client has read-only access                  |

## Matching

An `AFTER INSERT` trigger checks for the reciprocal Like and inserts one canonical match using `least(user_id)` and `greatest(user_id)`. The unique pair constraint and `ON CONFLICT DO NOTHING` prevent duplicate matches under concurrent requests.

## Discovery

`get_discovery_candidates` excludes the viewer, prior swipes, and blocks; enforces reciprocal interested gender; applies age, country, and gender filters; then prioritizes recently active, new, and more complete profiles. It is a simple deterministic ranking, not an AI recommender.

## RLS and security

- RLS is enabled on every public table.
- Profiles/photos are visible only to authenticated users and are hidden across a block.
- Swipes and settings are owner-scoped.
- Matches and messages are participant-scoped and become inaccessible across a block.
- Subscription rows are readable but not writable by clients.
- Profile photos use a private bucket. Object paths begin with the uploader's user ID.
- The mutual-match trigger is the only privileged write path; its function is in the unexposed `private` schema, has an empty search path, and cannot be executed directly by clients.

Run Supabase database advisors after applying the migration to a linked development project.
