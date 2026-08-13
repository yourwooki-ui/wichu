insert into public.interests (slug, label)
values
  ('music', 'Music'),
  ('travel', 'Travel'),
  ('photography', 'Photography'),
  ('cafe', 'Cafe'),
  ('movies', 'Movies'),
  ('fitness', 'Fitness'),
  ('gaming', 'Gaming'),
  ('fashion', 'Fashion'),
  ('language-exchange', 'Language Exchange'),
  ('food', 'Food')
on conflict (slug) do update set label = excluded.label;

-- Fictional WICHU discovery profiles for development only.
-- Every account is non-login-capable, uses a reserved @wichu.test address, and has a stable UUID
-- so this block is idempotent and can be removed cleanly before production launch.
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
values
  ('10000000-0000-4000-8000-000000000001', 'seed.yuna@wichu.test', '{"provider":"test","providers":["test"],"is_test":true}', '{"is_test":true,"display_name":"Yuna"}'),
  ('10000000-0000-4000-8000-000000000002', 'seed.camille@wichu.test', '{"provider":"test","providers":["test"],"is_test":true}', '{"is_test":true,"display_name":"Camille"}'),
  ('10000000-0000-4000-8000-000000000003', 'seed.sofia@wichu.test', '{"provider":"test","providers":["test"],"is_test":true}', '{"is_test":true,"display_name":"Sofia"}'),
  ('10000000-0000-4000-8000-000000000004', 'seed.maya@wichu.test', '{"provider":"test","providers":["test"],"is_test":true}', '{"is_test":true,"display_name":"Maya"}'),
  ('10000000-0000-4000-8000-000000000005', 'seed.lea@wichu.test', '{"provider":"test","providers":["test"],"is_test":true}', '{"is_test":true,"display_name":"Lea"}')
on conflict (id) do update set
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data;

insert into public.profiles (
  id,
  display_name,
  birth_date,
  gender,
  interested_in,
  country_code,
  native_language,
  languages,
  bio,
  is_active,
  terms_accepted_at,
  privacy_accepted_at,
  last_active_at,
  review_status,
  submitted_at,
  reviewed_at
)
values
  (
    '10000000-0000-4000-8000-000000000001', 'Yuna', '2003-04-18', 'woman',
    array['woman', 'man', 'nonbinary', 'other'], 'JP', 'ja', array['ja', 'en'],
    'I love film photography, live music, cozy cafés, and finding small restaurants.',
    true, now(), now(), now() - interval '2 minutes', 'approved', now() - interval '2 days', now() - interval '1 day'
  ),
  (
    '10000000-0000-4000-8000-000000000002', 'Camille', '2001-02-11', 'woman',
    array['woman', 'man', 'nonbinary', 'other'], 'FR', 'fr', array['fr', 'en'],
    'Usually at an exhibition or walking by the river. Always planning the next weekend trip.',
    true, now(), now(), now() - interval '18 minutes', 'approved', now() - interval '3 days', now() - interval '2 days'
  ),
  (
    '10000000-0000-4000-8000-000000000003', 'Sofia', '2002-06-02', 'woman',
    array['woman', 'man', 'nonbinary', 'other'], 'BR', 'pt', array['pt', 'en'],
    'A soft spot for sunset runs, dance playlists, street food, and meeting people from everywhere.',
    true, now(), now(), now() - interval '3 hours', 'approved', now() - interval '4 days', now() - interval '3 days'
  ),
  (
    '10000000-0000-4000-8000-000000000004', 'Maya', '2004-01-26', 'woman',
    array['woman', 'man', 'nonbinary', 'other'], 'CA', 'en', array['en', 'fr'],
    'Happiest near the water. Into hiking, cozy cafés, indie movies, and spontaneous plans.',
    true, now(), now(), now() - interval '2 days', 'approved', now() - interval '5 days', now() - interval '4 days'
  ),
  (
    '10000000-0000-4000-8000-000000000005', 'Lea', '2000-03-17', 'woman',
    array['woman', 'man', 'nonbinary', 'other'], 'DE', 'de', array['de', 'en'],
    'Into design, small concerts, long conversations, and a very serious search for great coffee.',
    true, now(), now(), now() - interval '6 days', 'approved', now() - interval '6 days', now() - interval '5 days'
  )
on conflict (id) do update set
  display_name = excluded.display_name,
  birth_date = excluded.birth_date,
  gender = excluded.gender,
  interested_in = excluded.interested_in,
  country_code = excluded.country_code,
  native_language = excluded.native_language,
  languages = excluded.languages,
  bio = excluded.bio,
  is_active = excluded.is_active,
  last_active_at = excluded.last_active_at,
  review_status = excluded.review_status,
  submitted_at = excluded.submitted_at,
  reviewed_at = excluded.reviewed_at;

insert into public.profile_photos (profile_id, storage_path, position)
values
  ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001/seed-primary.png', 1),
  ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002/seed-primary.png', 1),
  ('10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003/seed-primary.png', 1),
  ('10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004/seed-primary.png', 1),
  ('10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000005/seed-primary.png', 1)
on conflict (profile_id, position) do update set storage_path = excluded.storage_path;

insert into public.profile_interests (profile_id, interest_id)
select profile.id, interest.id
from (
  values
    ('10000000-0000-4000-8000-000000000001'::uuid, array['cafe', 'music', 'photography']),
    ('10000000-0000-4000-8000-000000000002'::uuid, array['travel', 'fashion', 'movies']),
    ('10000000-0000-4000-8000-000000000003'::uuid, array['music', 'fitness', 'food']),
    ('10000000-0000-4000-8000-000000000004'::uuid, array['travel', 'movies', 'cafe']),
    ('10000000-0000-4000-8000-000000000005'::uuid, array['music', 'photography', 'cafe'])
) as profile(id, interest_slugs)
join public.interests interest on interest.slug = any(profile.interest_slugs)
on conflict (profile_id, interest_id) do nothing;

insert into public.profile_languages (profile_id, language_code, proficiency)
values
  ('10000000-0000-4000-8000-000000000001', 'en', 'advanced'),
  ('10000000-0000-4000-8000-000000000002', 'en', 'fluent'),
  ('10000000-0000-4000-8000-000000000003', 'en', 'advanced'),
  ('10000000-0000-4000-8000-000000000004', 'fr', 'intermediate'),
  ('10000000-0000-4000-8000-000000000005', 'en', 'fluent')
on conflict (profile_id, language_code) do update set proficiency = excluded.proficiency;

insert into private.profile_locations (profile_id, location)
values
  ('10000000-0000-4000-8000-000000000001', extensions.st_setsrid(extensions.st_makepoint(139.6917, 35.6895), 4326)::extensions.geography),
  ('10000000-0000-4000-8000-000000000002', extensions.st_setsrid(extensions.st_makepoint(2.3522, 48.8566), 4326)::extensions.geography),
  ('10000000-0000-4000-8000-000000000003', extensions.st_setsrid(extensions.st_makepoint(-43.1729, -22.9068), 4326)::extensions.geography),
  ('10000000-0000-4000-8000-000000000004', extensions.st_setsrid(extensions.st_makepoint(-123.1207, 49.2827), 4326)::extensions.geography),
  ('10000000-0000-4000-8000-000000000005', extensions.st_setsrid(extensions.st_makepoint(13.4050, 52.5200), 4326)::extensions.geography)
on conflict (profile_id) do update set
  location = excluded.location,
  updated_at = now();

insert into public.profile_tags (profile_id, category, value)
values
  ('10000000-0000-4000-8000-000000000001', 'connection_goal', 'friends'),
  ('10000000-0000-4000-8000-000000000001', 'vibe', 'curious'),
  ('10000000-0000-4000-8000-000000000002', 'connection_goal', 'travel_buddy'),
  ('10000000-0000-4000-8000-000000000002', 'vibe', 'independent'),
  ('10000000-0000-4000-8000-000000000003', 'connection_goal', 'dating'),
  ('10000000-0000-4000-8000-000000000003', 'vibe', 'active'),
  ('10000000-0000-4000-8000-000000000004', 'connection_goal', 'friends'),
  ('10000000-0000-4000-8000-000000000004', 'vibe', 'warm'),
  ('10000000-0000-4000-8000-000000000005', 'connection_goal', 'language_exchange'),
  ('10000000-0000-4000-8000-000000000005', 'vibe', 'creative')
on conflict (profile_id, category, value) do nothing;

insert into public.user_settings (user_id, min_age, max_age, locale)
values
  ('10000000-0000-4000-8000-000000000001', 18, 35, 'ja'),
  ('10000000-0000-4000-8000-000000000002', 18, 35, 'fr'),
  ('10000000-0000-4000-8000-000000000003', 18, 35, 'pt'),
  ('10000000-0000-4000-8000-000000000004', 18, 35, 'en'),
  ('10000000-0000-4000-8000-000000000005', 18, 35, 'de')
on conflict (user_id) do update set
  min_age = excluded.min_age,
  max_age = excluded.max_age,
  locale = excluded.locale;
