-- Run with `supabase test db supabase/tests/p0_rls_contract.sql` against an isolated database.
-- The transaction is always rolled back and uses fixed test UUIDs only.
begin;

create extension if not exists pgtap with schema extensions;
select plan(46);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('30000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p0-a@example.test', '', now(), now()),
  ('30000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p0-b@example.test', '', now(), now()),
  ('30000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p0-c@example.test', '', now(), now()),
  ('30000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p0-d@example.test', '', now(), now());

insert into public.profiles (
  id, display_name, birth_date, gender, interested_in, country_code, native_language,
  languages, bio, terms_accepted_at, privacy_accepted_at, last_active_at, review_status,
  profile_completed
)
values
  ('30000000-0000-4000-8000-000000000001', 'P0 A', '2000-01-01', 'man', array['woman'], 'KR', 'ko', array['ko'], repeat('a', 24), now(), now(), now(), 'approved', true),
  ('30000000-0000-4000-8000-000000000002', 'P0 B', '2000-01-01', 'woman', array['man'], 'US', 'en', array['en'], repeat('b', 24), now(), now(), now(), 'approved', true),
  ('30000000-0000-4000-8000-000000000003', 'P0 C', '2000-01-01', 'woman', array['man'], 'JP', 'ja', array['ja'], repeat('c', 24), now(), now(), now(), 'pending', true),
  ('30000000-0000-4000-8000-000000000004', 'P0 D', '2000-01-01', 'woman', array['man'], 'KR', 'ko', array['ko'], repeat('d', 24), now(), now(), now(), 'approved', true);

insert into private.admin_users (user_id, role, active)
values ('30000000-0000-4000-8000-000000000003', 'master', true);

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}', false);
set local role authenticated;

select is((select count(*) from public.profiles where id = '30000000-0000-4000-8000-000000000003'), 0::bigint, 'pending profile is hidden');
select throws_ok(
  $$select birth_date from public.profiles where id = '30000000-0000-4000-8000-000000000002'$$,
  '42501',
  'permission denied for table profiles',
  'members cannot select exact birth dates from profile rows'
);
select is(
  (select birth_date from public.get_my_private_profile()),
  '2000-01-01'::date,
  'the self-only profile RPC returns the caller exact birth date'
);
select is(
  (
    select age
    from public.get_visible_profiles(array['30000000-0000-4000-8000-000000000002'::uuid])
  ),
  date_part('year', age(current_date, '2000-01-01'::date))::integer,
  'visible profile reads expose age instead of exact birth date'
);
select lives_ok(
  $$select public.register_my_push_device('ExpoPushToken[0123456789abcdefghijklmnop]', 'android', 'P0 device')$$,
  'member can register a push token through the controlled RPC'
);
select is(
  public.unregister_my_push_devices(),
  1,
  'member can remove only their own push devices through the controlled RPC'
);
select is((select count(*) from public.get_my_admin_access()), 0::bigint, 'member has no admin access');
select throws_ok($$select * from public.get_pending_reports()$$, 'P0001', 'Administrator access required', 'member cannot read report queue');

insert into public.user_settings (user_id, exclude_same_country)
values ('30000000-0000-4000-8000-000000000001', true)
on conflict (user_id) do update set exclude_same_country = excluded.exclude_same_country;

select is(
  (
    select count(*)
    from public.get_discovery_candidates(p_genders => array['woman']) candidate
    where candidate.id = '30000000-0000-4000-8000-000000000004'
  ),
  0::bigint,
  'same-country candidates are excluded when the preference is enabled'
);
select is(
  (
    select count(*)
    from public.get_discovery_candidates(p_genders => array['woman']) candidate
    where candidate.id = '30000000-0000-4000-8000-000000000002'
  ),
  1::bigint,
  'different-country candidates remain discoverable'
);

update public.user_settings
set exclude_same_country = false
where user_id = '30000000-0000-4000-8000-000000000001';

select is(
  (
    select count(*)
    from public.get_discovery_candidates(p_genders => array['woman']) candidate
    where candidate.id = '30000000-0000-4000-8000-000000000004'
  ),
  1::bigint,
  'same-country candidates return when the preference is disabled'
);

select lives_ok(
  $$select * from public.record_my_swipe('30000000-0000-4000-8000-000000000002', 'like')$$,
  'member can atomically swipe a valid candidate'
);
select is((select count(*) from public.swipes where swiper_id = auth.uid()), 1::bigint, 'swipe owner defaults to caller');
select is((select count(*) from public.swipes where swiper_id = auth.uid() and target_id = '30000000-0000-4000-8000-000000000002'), 1::bigint, 'duplicate swipe key is present');

select throws_ok(
  $$select * from public.undo_my_swipe('30000000-0000-4000-8000-000000000002')$$,
  'P0001',
  'Rewarded undo credit required',
  'a regular member cannot undo without a rewarded-ad credit'
);

reset role;
select is(
  public.grant_rewarded_undo_credit(
    '30000000-0000-4000-8000-000000000001',
    'p0-rewarded-ad-0001'
  ),
  1,
  'trusted rewarded-ad verification grants one undo credit'
);
select is(
  public.grant_rewarded_undo_credit(
    '30000000-0000-4000-8000-000000000001',
    'p0-rewarded-ad-0001'
  ),
  1,
  'the same rewarded-ad event cannot grant duplicate credits'
);

select is(
  public.process_revenuecat_subscription_event(
    'p0-revenuecat-event-0001',
    'INITIAL_PURCHASE',
    '30000000-0000-4000-8000-000000000001',
    'wichu_gold_monthly',
    'android',
    'active',
    now() + interval '1 month',
    'p0-provider-reference',
    now()
  ),
  true,
  'trusted billing verification activates a subscription'
);
select is(
  public.process_revenuecat_subscription_event(
    'p0-revenuecat-event-0001',
    'INITIAL_PURCHASE',
    '30000000-0000-4000-8000-000000000001',
    'wichu_gold_monthly',
    'android',
    'active',
    now() + interval '1 month',
    'p0-provider-reference',
    now()
  ),
  false,
  'a repeated billing event is idempotent'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}', false);
set local role authenticated;
select throws_ok(
  $$select public.process_revenuecat_subscription_event(
    'p0-revenuecat-event-0002',
    'INITIAL_PURCHASE',
    '30000000-0000-4000-8000-000000000001',
    'wichu_gold_monthly',
    'android',
    'active',
    now() + interval '1 month',
    'p0-provider-reference',
    now()
  )$$,
  '42501',
  'permission denied for function process_revenuecat_subscription_event',
  'members cannot grant their own paid entitlement'
);
select lives_ok(
  $$select * from public.undo_my_swipe('30000000-0000-4000-8000-000000000002')$$,
  'one rewarded-ad credit authorizes one undo'
);
select lives_ok(
  $$select * from public.record_my_swipe('30000000-0000-4000-8000-000000000002', 'like')$$,
  'the restored card can be swiped again after undo'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000002', false);
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}', false);
set local role authenticated;
select lives_ok(
  $$select * from public.record_my_swipe('30000000-0000-4000-8000-000000000001', 'like')$$,
  'reciprocal like completes atomically'
);

select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', false);
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}', false);
set local role authenticated;
select is((select count(*) from public.matches where user_a = least('30000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000002'::uuid)), 1::bigint, 'mutual like creates visible match');
select lives_ok(
  $$select public.send_my_message((select id from public.matches limit 1), '40000000-0000-4000-8000-000000000001', 'hello', 'en')$$,
  'participant can idempotently message active match'
);
select lives_ok(
  $$select public.send_my_message((select id from public.matches limit 1), '40000000-0000-4000-8000-000000000001', 'hello', 'en')$$,
  'retrying the same message is safe'
);
select is((select count(*) from public.messages), 1::bigint, 'message retry does not duplicate the row');
select is(
  (select count(*) from public.get_my_match_connections()),
  1::bigint,
  'match read model returns one active connection'
);
select is(
  (select last_message_content from public.get_my_match_connections() limit 1),
  'hello',
  'match read model returns the latest message per match'
);

select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000002', false);
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}', false);
set local role authenticated;
select is((select unread_count from public.get_my_unread_counts() limit 1), 1::bigint, 'recipient sees one unread message');
select lives_ok($$select public.mark_match_read((select id from public.matches limit 1))$$, 'recipient can mark the match read');
select is((select unread_count from public.get_my_unread_counts() limit 1), 0::bigint, 'read state clears the unread count');
select lives_ok(
  $$select * from public.claim_my_message_translation((select id from public.messages limit 1), 'ko-KR')$$,
  'participant can claim an on-demand translation'
);

reset role;
select public.complete_message_translation(
  (select id from public.messages limit 1),
  'ko',
  '안녕하세요'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000002', false);
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}', false);
set local role authenticated;
select is(
  (select cached_translation from public.claim_my_message_translation((select id from public.messages limit 1), 'ko')),
  '안녕하세요',
  'completed translation is returned from cache'
);
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000003', false);
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated"}', false);
set local role authenticated;
select is((select count(*) from public.messages), 0::bigint, 'nonparticipant cannot read messages');
select throws_ok(
  $$select * from public.claim_my_message_translation((select id from public.messages limit 1), 'ko')$$,
  '42501',
  'Message is unavailable',
  'nonparticipant cannot translate a message'
);
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
