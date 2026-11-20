-- Keep construction credit independent of the milestone/log deletion lifecycle.
ALTER TABLE activity ADD COLUMN cottage_milestones smallint NOT NULL DEFAULT 0
  CHECK (cottage_milestones BETWEEN 0 AND 3);

UPDATE activity AS a
SET cottage_milestones = LEAST(3, credited.total)
FROM (
  SELECT m.activity_id, COUNT(*) AS total
  FROM milestone AS m
  WHERE m.kind = 'achievement'
    AND EXISTS (
      SELECT 1 FROM activity_log AS l WHERE l.milestone_id = m.id AND l.is_success
    )
  GROUP BY m.activity_id
) AS credited
WHERE credited.activity_id = a.id;
