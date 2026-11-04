-- Staff todos: assignable internal work items with priority + status.
-- Run in Supabase SQL Editor. Notifications reuse the existing notifications table.

CREATE TABLE IF NOT EXISTS staff_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'done', 'cancelled')),
  due_date DATE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_todos_assignee ON staff_todos (assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_staff_todos_created_by ON staff_todos (created_by);
CREATE INDEX IF NOT EXISTS idx_staff_todos_status ON staff_todos (status);
CREATE INDEX IF NOT EXISTS idx_staff_todos_priority ON staff_todos (priority);

ALTER TABLE staff_todos ENABLE ROW LEVEL SECURITY;

-- Service role / server uses the anon/service key through app routes; deny direct anon access.
DROP POLICY IF EXISTS staff_todos_deny_anon ON staff_todos;
CREATE POLICY staff_todos_deny_anon ON staff_todos
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
