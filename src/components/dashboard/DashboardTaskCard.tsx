'use client'

import { useState } from 'react'
import FileDropzone from '@/components/ui/FileDropzone'
import { isFileUploadTask, TASK_FILE_UPLOAD_ACCEPT } from '@/lib/tasks'

export interface DashboardTaskFile {
  id: string
  name: string
  file_url: string
  file_size?: number
}

export interface DashboardTask {
  id: string
  title: string
  description: string
  status: 'not_started' | 'in_progress' | 'in_review' | 'completed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_date: string | null
  category: string
  task_type?: string
  files?: DashboardTaskFile[]
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatFileSize(bytes: number): string {
  if (!bytes) return ''
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`
}

function statusLabel(status: DashboardTask['status']): string {
  switch (status) {
    case 'not_started':
      return 'Not Started'
    case 'in_progress':
      return 'In Progress'
    case 'in_review':
      return 'In Review'
    case 'completed':
      return 'Completed'
    default:
      return status
  }
}

function statusColor(status: DashboardTask['status']): string {
  switch (status) {
    case 'not_started':
      return 'bg-gray-50 border-gray-200'
    case 'in_progress':
      return 'bg-blue-50 border-blue-200'
    case 'in_review':
      return 'bg-purple-50 border-purple-200'
    case 'completed':
      return 'bg-green-50 border-green-200'
    default:
      return 'bg-gray-50 border-gray-200'
  }
}

function statusBadgeColor(status: DashboardTask['status']): string {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'in_review':
      return 'bg-purple-100 text-purple-800 border-purple-200'
    case 'in_progress':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'not_started':
      return 'bg-gray-100 text-gray-800 border-gray-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

function priorityColor(priority: DashboardTask['priority']): string {
  switch (priority) {
    case 'urgent':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'high':
      return 'bg-amber-100 text-amber-800 border-amber-200'
    case 'medium':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'low':
      return 'bg-gray-100 text-gray-800 border-gray-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

export default function DashboardTaskCard({
  task,
  onTaskUpdated,
}: {
  task: DashboardTask
  onTaskUpdated: (task: DashboardTask) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const canUpload = isFileUploadTask(task) && task.status !== 'completed'
  const files = task.files || []

  const handleFile = async (file: File) => {
    setUploading(true)
    setUploadError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('task_id', task.id)
      fd.append('category', 'general')
      const res = await fetch('/api/dashboard/files', { method: 'POST', body: fd })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setUploadError(typeof body.error === 'string' ? body.error : 'Upload failed')
        return
      }
      const uploaded: DashboardTaskFile = {
        id: String(body.id),
        name: String(body.name),
        file_url: String(body.file_url ?? ''),
        file_size: Number(body.file_size) || file.size,
      }
      const rawStatus = body.task && typeof body.task.status === 'string' ? body.task.status : 'in_review'
      const nextStatus: DashboardTask['status'] =
        rawStatus === 'not_started' ||
        rawStatus === 'in_progress' ||
        rawStatus === 'in_review' ||
        rawStatus === 'completed'
          ? rawStatus
          : 'in_review'
      onTaskUpdated({
        ...task,
        status: nextStatus,
        files: [...files, uploaded],
      })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={`border border-brand-border rounded-2xl p-6 ${statusColor(task.status)}`}>
      <div className="flex items-start justify-between mb-3">
        <h3
          className={`text-brand-text font-serif text-lg flex-1 ${task.status === 'completed' ? 'line-through opacity-60' : ''}`}
        >
          {task.title}
        </h3>
        <span
          className={`ml-4 px-3 py-1 rounded-full text-xs font-medium border ${statusBadgeColor(task.status)}`}
        >
          {statusLabel(task.status)}
        </span>
      </div>
      {task.description && (
        <p
          className={`text-brand-muted text-sm mb-4 ${task.status === 'completed' ? 'opacity-60' : ''} ${canUpload ? '' : 'line-clamp-2'}`}
        >
          {task.description}
        </p>
      )}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium border ${priorityColor(task.priority)}`}
          >
            {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
          </span>
          <span className="px-3 py-1 bg-accent-soft text-accent border border-accent/20 rounded-full text-xs font-medium">
            {isFileUploadTask(task) ? 'File upload' : task.category}
          </span>
        </div>
        {task.due_date && (
          <p className="text-brand-muted text-sm">Due: {formatDate(task.due_date)}</p>
        )}
      </div>

      {isFileUploadTask(task) && (
        <div className="mt-4 space-y-3">
          {files.length > 0 && (
            <ul className="space-y-2">
              {files.map((file) => (
                <li key={file.id}>
                  <a
                    href={file.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-accent hover:underline break-all"
                  >
                    {file.name}
                    {file.file_size ? ` (${formatFileSize(file.file_size)})` : ''}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {canUpload && (
            <FileDropzone
              onFile={handleFile}
              accept={TASK_FILE_UPLOAD_ACCEPT}
              clickToSelect
              disabled={uploading}
            >
              <p className="text-sm text-brand-text font-medium text-center">
                {uploading ? 'Uploading…' : 'Drop a file here or click to upload'}
              </p>
              <p className="text-xs text-brand-muted text-center mt-1">
                PDF, images, Office docs, CSV, or ZIP — up to 4 MB
              </p>
            </FileDropzone>
          )}
          {uploadError && <p className="text-sm text-red-700">{uploadError}</p>}
        </div>
      )}
    </div>
  )
}
