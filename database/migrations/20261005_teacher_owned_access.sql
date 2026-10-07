ALTER TABLE users
    ALTER COLUMN status SET DEFAULT 'active';

UPDATE users
SET status = 'active'
WHERE profile IN ('student', 'teacher')
  AND status = 'pending';
