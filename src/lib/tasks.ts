export const TASK_TYPES = ['general', 'file_upload'] as const

export type TaskType = (typeof TASK_TYPES)[number]

export function parseTaskType(value: unknown): TaskType {
  if (value === 'file_upload') return 'file_upload'
  return 'general'
}

export function isFileUploadTask(task: {
  task_type?: string | null
  category?: string | null
}): boolean {
  return parseTaskType(task.task_type) === 'file_upload' || task.category === 'file_upload'
}

/** Matches allowed client-vault types in `client-files-storage`. */
export const TASK_FILE_UPLOAD_ACCEPT =
  '.pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx,.zip'
