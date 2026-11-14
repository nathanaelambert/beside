-- Whiteboard example (2026-11-14): one school org, homebases 3A, 3B, 3A+3B, 4A, 4B.
INSERT INTO organization (id, type, name, region) VALUES ('org_school', 'school', 'Example School', 'ca');
INSERT INTO sport (id, name) VALUES ('sport_football', 'Futbol');

INSERT INTO homebase (id, org_id, name, type, parent_homebase_id) VALUES
  ('hb_school', 'org_school', 'Example School', 'school', NULL),
  ('hb_3A',     'org_school', '3A',    'class',          'hb_school'),
  ('hb_3B',     'org_school', '3B',    'class',          'hb_school'),
  ('hb_3A_3B',  'org_school', '3A+3B', 'school_project', 'hb_school'),
  ('hb_4A',     'org_school', '4A',    'class',          'hb_school'),
  ('hb_4B',     'org_school', '4B',    'class',          'hb_school');

INSERT INTO homebase_composition (combined_homebase_id, source_homebase_id, org_id) VALUES
  ('hb_3A_3B', 'hb_3A', 'org_school'),
  ('hb_3A_3B', 'hb_3B', 'org_school');

INSERT INTO app_user (id, name, email, user_type, home_homebase_id) VALUES
  ('user_pritesh', 'Pritesh', 'pritesh@example.com', 'teacher', 'hb_4A'),
  ('user_mosab',   'Mosab',   'mosab@example.com',   'student', NULL);

INSERT INTO org_membership (org_id, user_id, role) VALUES
  ('org_school', 'user_pritesh', 'teacher'),
  ('org_school', 'user_mosab',   'student');

-- HOMEBASE_P lists, one row per homebase
INSERT INTO homebase_member (homebase_id, user_id, org_id, role) VALUES
  ('hb_3A',    'user_pritesh', 'org_school', 'teacher'),
  ('hb_3B',    'user_pritesh', 'org_school', 'teacher'),
  ('hb_3A_3B', 'user_pritesh', 'org_school', 'teacher'),
  ('hb_3A',    'user_mosab',   'org_school', 'member'),
  ('hb_3A_3B', 'user_mosab',   'org_school', 'member');

INSERT INTO homebase_sport (homebase_id, sport_id, org_id) VALUES
  ('hb_3A_3B', 'sport_football', 'org_school');
