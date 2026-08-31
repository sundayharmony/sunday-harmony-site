import { getFilesByTaskIds, type FileRecord, type Task } from '@/lib/db'
import { withSignedClientFileUrls } from '@/lib/client-files-storage'

export type TaskWithFiles = Task & { files: FileRecord[] }

export async function attachFilesToTasks(tasks: Task[]): Promise<TaskWithFiles[]> {
  if (tasks.length === 0) return []
  const files = await getFilesByTaskIds(tasks.map((task) => task.id))
  const signed = await withSignedClientFileUrls(files)
  const byTask = new Map<string, FileRecord[]>()
  for (const file of signed) {
    if (!file.task_id) continue
    const list = byTask.get(file.task_id) || []
    list.push(file)
    byTask.set(file.task_id, list)
  }
  return tasks.map((task) => ({ ...task, files: byTask.get(task.id) || [] }))
}
