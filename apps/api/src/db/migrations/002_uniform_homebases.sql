-- Preserve all existing bases, memberships, progress and rewards. Former
-- personal bases become ordinary, inviteable home bases with one member.
ALTER TABLE activity DROP CONSTRAINT activity_check;
UPDATE activity a SET connection_id = h.id
FROM homebase h WHERE a.personal_owner_id = h.personal_owner_id AND a.connection_id IS NULL;
ALTER TABLE activity ALTER COLUMN connection_id SET NOT NULL;

-- Every activity now uses its base's audience. Backfill the same audience for
-- existing milestone logs and preserved historical contributions.
INSERT INTO log_share (id, log_id, connection_id, shared_by_user_id)
SELECT 'share_' || gen_random_uuid()::text, l.id, a.connection_id, l.author_user_id
FROM activity_log l
JOIN milestone m ON m.id = l.milestone_id
JOIN activity a ON a.id = m.activity_id
WHERE a.personal_owner_id IS NOT NULL
ON CONFLICT (log_id, connection_id) DO NOTHING;
INSERT INTO log_share (id, log_id, connection_id, shared_by_user_id)
SELECT 'share_' || gen_random_uuid()::text, l.id, a.connection_id, l.author_user_id
FROM activity_log l
JOIN log_contribution c ON c.log_id = l.id
JOIN participation p ON p.id = c.participation_id
JOIN activity a ON a.id = p.activity_id
WHERE a.personal_owner_id IS NOT NULL
ON CONFLICT (log_id, connection_id) DO NOTHING;

INSERT INTO homebase_invite (homebase_id, code)
SELECT id, replace(gen_random_uuid()::text, '-', '') FROM homebase
ON CONFLICT (homebase_id) DO NOTHING;
DROP INDEX activity_scope;
ALTER TABLE activity DROP COLUMN personal_owner_id;
ALTER TABLE homebase DROP COLUMN personal_owner_id;
CREATE INDEX activity_scope ON activity(connection_id);
