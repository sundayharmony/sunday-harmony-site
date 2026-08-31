import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { isFileUploadTask, parseTaskType } from '../tasks'

function source(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('file-upload tasks', () => {
  it('parses task types and identifies upload tasks', () => {
    assert.equal(parseTaskType('file_upload'), 'file_upload')
    assert.equal(parseTaskType('general'), 'general')
    assert.equal(parseTaskType('unknown'), 'general')
    assert.equal(isFileUploadTask({ task_type: 'file_upload' }), true)
    assert.equal(isFileUploadTask({}), false)
    assert.equal(isFileUploadTask({ category: 'file_upload' }), true)
  })

  it('binds client vault uploads to an owned file-upload task', () => {
    const files = source('src/app/api/dashboard/files/route.ts')
    const adminTasks = source('src/app/api/admin/tasks/route.ts')
    const dashboardTasks = source('src/app/api/dashboard/tasks/route.ts')
    const migration = source('supabase-migration-032-task-file-upload.sql')

    assert.match(files, /getTaskById\(taskId\)/)
    assert.match(files, /uploadTask\.client_id !== clientId/)
    assert.match(files, /isFileUploadTask\(uploadTask\)/)
    assert.match(files, /task_id: uploadTask\.id/)
    assert.match(files, /status: 'in_review'/)
    assert.match(adminTasks, /task_type: parsedType/)
    assert.match(adminTasks, /attachFilesToTasks/)
    assert.match(dashboardTasks, /attachFilesToTasks/)
    assert.match(migration, /task_type TEXT NOT NULL DEFAULT 'general'/)
    assert.match(migration, /ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES tasks\(id\)/)
  })
})
