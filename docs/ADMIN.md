# Admin Access

WICHU operations accounts use Supabase Auth for credentials and the private
`private.admin_users` table for authorization. Passwords, emails, and bootstrap
user IDs must never be committed to the repository.

## Roles

- `master`: top-level operations administrator. `parent_user_id` must be null.
- `operator`: delegated administrator. `parent_user_id` must reference an active
  `master` account.

The role table is not exposed through the Data API. `anon` and `authenticated`
have no table privileges, RLS is forced, and role changes are server-managed.

## Provisioning

1. Create and confirm the account in Supabase Authentication.
2. Obtain the Auth user UUID without copying credentials into SQL or docs.
3. Insert the master role first, then insert operators with the master's UUID as
   `parent_user_id`.
4. Verify the hierarchy, confirmation state, table privileges, and Security
   Advisor results.

Do not add a general-purpose admin RPC. Add narrowly scoped server endpoints or
RLS policies only when the operations console is implemented. Require password
rotation and MFA before production access is granted.

## Operations center

Active administrators see `설정 → 운영 센터`. Access is resolved by
`get_my_admin_access()` against `private.admin_users`; client-editable user
metadata is never used for authorization.

- Profile queue: oldest pending submissions first, approve or reject through
  `review_profile_submission`.
- Report queue: oldest pending reports first, mark reviewed or closed through
  `resolve_report`.
- The queue RPCs and mutation RPCs each repeat the database admin check and
  expose only the fields the operations screen requires.

Before production access, require MFA, rotate any bootstrap password, and
verify both master and operator accounts with `supabase/tests/p0_rls_contract.sql`.
