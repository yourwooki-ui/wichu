-- Run with `supabase test db supabase/tests/interaction_lifecycle_contract.sql`.
-- Fixed UUIDs are isolated in a rolled-back transaction.
begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('31000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lifecycle-a@example.test', '', now(), now()),
  ('31000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lifecycle-b@example.test', '', now(), now()),
  ('31000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lifecycle-c@example.test', '', now(), now()),
  ('31000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lifecycle-d@example.test', '', now(), now());

insert into public.profiles (
  id, display_name, birth_date, gender, interested_in, country_code, native_language,
  languages, bio, terms_accepted_at, privacy_accepted_at, last_active_at, review_status,
  profile_completed
)
values
  ('31000000-0000-4000-8000-000000000001', 'Lifecycle A', '2000-01-01', 'man', array['woman'], 'KR', 'ko', array['ko'], repeat('a', 24), now(), now(), now(), 'approved', true),
  ('31000000-0000-4000-8000-000000000002', 'Lifecycle B', '2000-01-01', 'woman', array['man'], 'US', 'en', array['en'], repeat('b', 24), now(), now(), now(), 'approved', true),
  ('31000000-0000-4000-8000-000000000003', 'Lifecycle C', '2000-01-01', 'woman', array['man'], 'JP', 'ja', array['ja'], repeat('c', 24), now(), now(), now(), 'approved', true),
  ('31000000-0000-4000-8000-000000000004', 'Lifecycle D', '2000-01-01', 'woman', array['man'], 'FR', 'fr', array['fr'], repeat('d', 24), now(), now(), now() - interval '8 days', 'approved', true);

-- Historical interactions prove that expiration derives from the server timestamp.
insert into public.swipes (swiper_id, target_id, action, created_at)
values
  ('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000003', 'pass', now() - interval '4 days'),
  ('31000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000001', 'like', now() - interval '2 days');

select is(
  (
    select expires_at
    from public.swipes
    where swiper_id = '31000000-0000-4000-8000-000000000001'
      and target_id = '31000000-0000-4000-8000-000000000003'
  ),
  (
    select created_at + interval '3 days'
    from public.swipes
    where swiper_id = '31000000-0000-4000-8000-000000000001'
      and target_id = '31000000-0000-4000-8000-000000000003'
  ),
  'a pass expires exactly three days after creation'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000001', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claims', '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated"}', false);
set local role authenticated;

select is(
  (select count(*) from public.get_discovery_candidates() where id = '31000000-0000-4000-8000-000000000003'),
  1::bigint,
  'a profile returns to discovery after its pass expires'
);
select is(
  (select count(*) from public.get_discovery_candidates() where id = '31000000-0000-4000-8000-000000000004'),
  0::bigint,
  'profiles inactive for more than seven days are excluded'
);
select lives_ok(
  $$select * from public.record_my_swipe('31000000-0000-4000-8000-000000000002', 'like')$$,
  'a current pick can be recorded after the reciprocal historical pick expired'
);
select is(
  (select count(*) from public.matches),
  0::bigint,
  'an expired reciprocal pick cannot create a match'
);
select is(
  (
    select expires_at
    from public.swipes
    where swiper_id = auth.uid()
      and target_id = '31000000-0000-4000-8000-000000000002'
  ),
  (
    select created_at + interval '1 day'
    from public.swipes
    where swiper_id = auth.uid()
      and target_id = '31000000-0000-4000-8000-000000000002'
  ),
  'a pick expires exactly one day after creation'
);
select is(
  (select count(*) from public.get_discovery_candidates() where id = '31000000-0000-4000-8000-000000000002'),
  0::bigint,
  'an active pick suppresses the profile in discovery'
);

select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000002', false);
select set_config('request.jwt.claims', '{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated"}', false);
set local role authenticated;
select is(
  (select count(*) from public.get_my_incoming_likes() where profile_id = '31000000-0000-4000-8000-000000000001'),
  1::bigint,
  'only the still-active received pick is returned'
);
select lives_ok(
  $$select * from public.record_my_swipe('31000000-0000-4000-8000-000000000001', 'like')$$,
  'an expired prior pick can be replaced by a new reciprocal pick'
);
select is((select count(*) from public.matches), 1::bigint, 'two active picks create one match');

reset role;
update public.matches set matched_at = now() - interval '1 year';

set local role authenticated;
select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000002', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claims', '{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated"}', false);
set local role authenticated;
select lives_ok(
  $$select public.send_my_message((select id from public.matches limit 1), '41000000-0000-4000-8000-000000000001', 'still open', 'en')$$,
  'matches and conversations do not expire automatically'
);
select lives_ok(
  $$select public.end_my_match((select id from public.matches limit 1))$$,
  'a participant can explicitly leave and end the conversation'
);

select * from finish();
rollback;
