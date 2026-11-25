-- A guest has no email or credential row. PostgreSQL's UNIQUE constraint
-- continues to reject duplicate account emails and permits multiple NULLs.
ALTER TABLE app_user ALTER COLUMN email DROP NOT NULL;
