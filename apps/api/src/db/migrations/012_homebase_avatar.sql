-- Existing memberships keep their original renderer until a member saves a design.
ALTER TABLE homebase_member ADD COLUMN avatar_appearance jsonb;
