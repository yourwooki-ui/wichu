-- Run with `supabase test db supabase/tests/p0_rls_contract.sql` against an isolated database.
-- The transaction is always rolled back and uses fixed test UUIDs only.
begin;

create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('30000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p0-a@example.test', '', now(), now()),
  ('30000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p0-b@example.test', '', now(), now()),
  ('30000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p0-c@example.test', '', now(), now());

insert into public.profiles (
  id, display_name, birth_date, gender, interested_in, country_code, native_language,
  languages, bio, terms_accepted_at, privacy_accepted_at, review_status
)
values
  ('30000000-0000-4000-8000-000000000001', 'P0 A', '2000-01-01', 'man', array['woman'], 'KR', 'ko', array['ko'], repeat('a', 24), now(), now(), 'approved'),
  ('30000000-0000-4000-8000-000000000002', 'P0 B', '2000-01-01', 'woman', array['man'], 'US', 'en', array['en'], repeat('b', 24), now(), now(), 'approved'),
  ('30000000-0000-4000-8000-000000000003', 'P0 C', '2000-01-01', 'woman', array['man'], 'JP', 'ja', array['ja'], repeat('c', 24), now(), now(), 'pending');

insert into private.admin_users (user_id, role, active)
values ('30000000-0000-4000-8000-000000000003', 'master', true);

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}', false);
set local role authenticated;

select is((select count(*) from public.profiles where id = '30000000-0000-4000-8000-000000000003'), 0::bigint, 'pending profile is hidden');
select is((select count(*) from public.get_my_admin_access()), 0::bigint, 'member has no admin access');
select throws_ok($$select * from public.get_pending_reports()$$, 'P0001', 'Administrator access required', 'member cannot read report queue');

insert into public.swipes (target_id, action) values ('30000000-0000-4000-8000-000000000002', 'like');
select pass('member can swipe valid candidate');
select is((select count(*) from public.swipes where swiper_id = auth.uid()), 1::bigint, 'swipe owner defaults to caller');
select is((select count(*) from public.swipes where swiper_id = auth.uid() and target_id = '30000000-0000-4000-8000-000000000002'), 1::bigint, 'duplicate swipe key is present');

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000002', false);
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}', false);
set local role authenticated;
insert into public.swipes (target_id, action)
values ('30000000-0000-4000-8000-000000000001', 'like');

select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', false);
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}', false);
set local role authenticated;
select is((select count(*) from public.matches where user_a = least('30000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000002'::uuid)), 1::bigint, 'mutual like creates visible match');
select lives_ok($$insert into public.messages (match_id, content) select id, 'hello' from public.matches limit 1$$, 'participant can message active match');

select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000003', false);
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated"}', false);
set local role authenticated;
select is((select count(*) from public.messages), 0::bigint, 'nonparticipant cannot read messages');
select is((select count(*) from public.matches), 0::bigint, 'nonparticipant cannot see match rows');
select is((select role from public.get_my_admin_access()), 'master', 'database role grants admin access');

reset role;
insert into public.reports (reporter_id, reported_id, reason)
values ('30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'other');

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000003', false);
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated"}', false);
set local role authenticated;
select is((select count(*) from public.get_pending_reports()), 1::bigint, 'admin can read report queue');
select lives_ok($$select public.resolve_report((select id from public.get_pending_reports() limit 1), 'reviewed')$$, 'admin can resolve report');

select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', false);
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}', false);
set local role authenticated;
select lives_ok(
  format('select public.end_my_match(%L)', (select id from public.matches limit 1)),
  'participant can end active match'
);
select is((select count(*) from public.matches), 0::bigint, 'ended match is hidden from participant');
select is((select count(*) from public.messages), 0::bigint, 'ended match messages are hidden');

select lives_ok(
  $$select public.request_my_account_deletion()$$,
  'user can request their own account deletion'
);
select ok(
  public.claim_my_account_deletion(),
  'user can atomically claim their pending deletion request'
);
select isnt(
  public.claim_my_account_deletion(),
  true,
  'a processing deletion request cannot be claimed twice'
);
select * from finish();

rollback;
