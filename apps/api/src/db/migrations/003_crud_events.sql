-- Home-base changes and deletion notices reference a surviving base or user.
ALTER TABLE domain_event DROP CONSTRAINT domain_event_entity_type_check;
ALTER TABLE domain_event ADD CONSTRAINT domain_event_entity_type_check
  CHECK (entity_type IN ('subject', 'activity', 'log', 'milestone', 'reward', 'homebase', 'user'));
