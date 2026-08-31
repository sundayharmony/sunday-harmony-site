-- Migration 032: File-upload tasks
-- Lets staff assign a file-upload task; client vault files can be linked to that task.
-- Project: hvsoeezsbvwsrdobvgaz. Service role / Next.js only.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS task_type TEXT NOT NULL DEFAULT 'general';

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_task_type_check;
ALTER TABLE tasks
  ADD CONSTRAINT tasks_task_type_check
  CHECK (task_type IN ('general', 'file_upload'));

ALTER TABLE files
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_files_task_id ON files(task_id);
