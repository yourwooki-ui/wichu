-- Run with `supabase test db supabase/tests/moderation_workflow_contract.sql`.
-- Fixed UUIDs are isolated in a rolled-back transaction.
begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('32000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reporter@example.test', '', now(), now()),
  ('32000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reported@example.test', '', now(), now()),
  ('32000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'master@example.test', '', now(), now()),
  ('32000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'operator@example.test', '', now(), now());

insert into public.profiles (
  id, display_name, birth_date, gender, interested_in, country_code, native_language,
  languages, bio, terms_accepted_at, privacy_accepted_at, review_status, profile_completed
)
values
  ('32000000-0000-4000-8000-000000000001', 'Reporter', '2000-01-01', 'man', array['woman'], 'KR', 'ko', array['ko'], repeat('a', 24), now(), now(), 'approved', true),
  ('32000000-0000-4000-8000-000000000002', 'Reported', '2000-01-01', 'woman', array['man'], 'US', 'en', array['en'], repeat('b', 24), now(), now(), 'approved', true),
  ('32000000-0000-4000-8000-000000000003', 'Master', '2000-01-01', 'woman', array['man'], 'JP', 'ja', array['ja'], repeat('c', 24), now(), now(), 'approved', true),
  ('32000000-0000-4000-8000-000000000004', 'Operator', '2000-01-01', 'woman', array['man'], 'FR', 'fr', array['fr'], repeat('d', 24), now(), now(), 'approved', true);

insert into private.admin_users (user_id, role, active)
values ('32000000-0000-4000-8000-000000000003', 'master', true);

set local role authenticated;
select set_config('request.jwt.claim.sub', '32000000-0000-4000-8000-000000000001', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claims', '{"sub":"32000000-0000-4000-8000-000000000001","role":"authenticated"}', false);

select lives_ok(
  $$select public.submit_report(
    '32000000-0000-4000-8000-000000000002',
    array['harassment', 'spam'],
    'Repeated unwanted messages',
    'profile',
    null
  )$$,
  'member can submit a structured report'
);
select is(
  (select reasons from public.reports where reporter_id = auth.uid()),
  array['harassment', 'spam']::text[],
  'the report preserves validated reason codes'
);
select is(
  (select report_context from public.reports where reporter_id = auth.uid()),
  'profile'::varchar,
  'the report records its product context'
);
select throws_ok(
  $$select public.submit_report(
    '32000000-0000-4000-8000-000000000002',
    array['other'],
    null,
    'profile',
    null
  )$$,
  'P0001',
  'Details are required for other reports',
  'other reports require reviewable details'
);
select throws_ok(
  $$select public.submit_report(
    '32000000-0000-4000-8000-000000000002',
    array['not-a-reason'],
    null,
    'profile',
    null
  )$$,
  'P0001',
  'Choose between one and three valid report reasons',
  'unknown reason codes are rejected server-side'
);
select throws_ok(
  $$select * from public.get_pending_reports()$$,
  'P0001',
  'Administrator access required',
  'regular members cannot read the moderation queue'
);

select set_config('request.jwt.claim.sub', '32000000-0000-4000-8000-000000000003', false);
select set_config('request.jwt.claims', '{"sub":"32000000-0000-4000-8000-000000000003","role":"authenticated"}', false);

select is(
  public.set_operator_access('operator@example.test', true),
  '32000000-0000-4000-8000-000000000004'::uuid,
  'master can grant operator access to an existing account'
);
select is(
  (select count(*) from public.get_admin_team() where role = 'operator' and active),
  1::bigint,
  'master can inspect the active operations team'
);

select set_config('request.jwt.claim.sub', '32000000-0000-4000-8000-000000000004', false);
select set_config('request.jwt.claims', '{"sub":"32000000-0000-4000-8000-000000000004","role":"authenticated"}', false);

select is((select count(*) from public.get_pending_reports()), 1::bigint, 'operator can read the queue');
select throws_ok(
  $$select public.resolve_report_v2(
    (select id from public.reports where status = 'pending' limit 1),
    'reviewed',
    null,
    'profile_hidden'
  )$$,
  'P0001',
  'Master administrator access required',
  'operator cannot run the master-only visibility action'
);
select lives_ok(
  $$select public.resolve_report_v2(
    (select id from public.reports where status = 'pending' limit 1),
    'reviewed',
    'Reviewed by operator',
    'none'
  )$$,
  'operator can resolve a report without punitive account action'
);

reset role;
select is(
  (select count(*) from private.moderation_audit_log where action = 'report_reviewed'),
  1::bigint,
  'report resolution creates an immutable audit entry'
);

select * from finish();
rollback;
