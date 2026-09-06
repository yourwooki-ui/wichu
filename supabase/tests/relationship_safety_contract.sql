-- Run with `supabase test db supabase/tests/relationship_safety_contract.sql`.
begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('33000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'feedback-a@example.test', '', now(), now()),
  ('33000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'feedback-b@example.test', '', now(), now()),
  ('33000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'feedback-c@example.test', '', now(), now());

insert into public.profiles (
  id, display_name, birth_date, gender, interested_in, country_code, native_language,
  languages, bio, terms_accepted_at, privacy_accepted_at, review_status, profile_completed
)
values
  ('33000000-0000-4000-8000-000000000001', 'Feedback A', '2000-01-01', 'man', array['woman'], 'KR', 'ko', array['ko'], repeat('a', 24), now(), now(), 'approved', true),
  ('33000000-0000-4000-8000-000000000002', 'Feedback B', '2000-01-01', 'woman', array['man'], 'US', 'en', array['en'], repeat('b', 24), now(), now(), 'approved', true),
  ('33000000-0000-4000-8000-000000000003', 'Feedback C', '2000-01-01', 'woman', array['man'], 'JP', 'ja', array['ja'], repeat('c', 24), now(), now(), 'approved', true);

insert into public.matches (id, user_a, user_b)
values
  ('33000000-0000-4000-8000-000000000010', '33000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000002'),
  ('33000000-0000-4000-8000-000000000011', '33000000-0000-4000-8000-000000000002', '33000000-0000-4000-8000-000000000003');

set local role authenticated;
select set_config('request.jwt.claim.sub', '33000000-0000-4000-8000-000000000001', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claims', '{"sub":"33000000-0000-4000-8000-000000000001","role":"authenticated"}', false);

select lives_ok(
  $$select * from public.replace_my_profile_prompts('[
    {"prompt_key":"ideal_weekend","answer":"Coffee and a long walk","position":0},
    {"prompt_key":"learning_now","answer":"Learning Korean recipes","position":1}
  ]'::jsonb)$$,
  'members can atomically replace their profile prompts'
);
select is(
  (select count(*) from public.profile_prompts where profile_id = auth.uid()),
  2::bigint,
  'the prompt bundle is stored for its owner'
);
select throws_ok(
  $$select * from public.replace_my_profile_prompts('[
    {"prompt_key":"not_allowed","answer":"This should fail","position":0}
  ]'::jsonb)$$,
  '23514',
  null,
  'unknown prompt keys are rejected by the database constraint'
);

select lives_ok(
  $$select public.submit_my_date_feedback(
    '33000000-0000-4000-8000-000000000010', true, true, false, 'Felt comfortable'
  )$$,
  'a match participant can submit private date feedback'
);
select is(
  (select meet_again from public.date_feedback where reviewer_id = auth.uid()),
  true,
  'the participant can read their own feedback'
);
select throws_ok(
  $$select public.submit_my_date_feedback(
    '33000000-0000-4000-8000-000000000011', true, false, false, null
  )$$,
  'P0001',
  'Match not found',
  'a non-participant cannot submit feedback for another match'
);

reset role;
select ok(
  has_column_privilege('authenticated', 'public.reports', 'status', 'select'),
  'reporters can read report status'
);
select ok(
  not has_column_privilege('authenticated', 'public.reports', 'resolution_note', 'select'),
  'internal moderation notes are hidden from reporters'
);
select ok(
  not has_function_privilege('anon', 'public.submit_my_date_feedback(uuid,boolean,boolean,boolean,text)', 'execute'),
  'anonymous users cannot submit date feedback'
);

select * from finish();
rollback;
