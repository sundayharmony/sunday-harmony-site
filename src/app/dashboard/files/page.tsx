'use client';

import { useEffect, useState, useRef } from 'react';

interface FileItem {
  id: string;
  name: string;
  type: string;
  size: number;
  uploaded_by: string;
  created_at: string;
  category: 'report' | 'graphic' | 'content' | 'brand' | 'general';
  file_url: string;
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<globalThis.File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDisplayName, setUploadDisplayName] = useState('');
  const [uploadCategory, setUploadCategory] = useState<FileItem['category']>('general');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Fetch files
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const res = await fetch('/api/dashboard/files');
        if (!res.ok) throw new Error('Failed to fetch files');
        const result = await res.json();
        const raw = Array.isArray(result) ? result : (result.data || []);
        setFiles(
          raw.map((f: Record<string, unknown>) => ({
            id: String(f.id),
            name: String(f.name),
            type: String(f.file_type ?? ''),
            size: Number(f.file_size) || 0,
            uploaded_by: String(f.uploaded_by_name ?? f.uploaded_by ?? ''),
            created_at: String(f.created_at ?? ''),
            category: (['report', 'graphic', 'content', 'brand', 'general'].includes(String(f.category))
              ? (f.category as FileItem['category'])
              : 'general'),
            file_url: String(f.file_url ?? ''),
          }))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, []);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString: string): string => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  // Handle file upload
  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      if (uploadDisplayName.trim()) fd.append('name', uploadDisplayName.trim());
      fd.append('category', uploadCategory);

      const res = await fetch('/api/dashboard/files', {
        method: 'POST',
        body: fd,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === 'string' ? body.error : 'Upload failed');
        return;
      }
      const f = body as Record<string, unknown>;
      setFiles(prev => [
        ...prev,
        {
          id: String(f.id),
          name: String(f.name),
          type: String(f.file_type ?? ''),
          size: Number(f.file_size) || 0,
          uploaded_by: String(f.uploaded_by_name ?? f.uploaded_by ?? 'You'),
          created_at: String(f.created_at ?? new Date().toISOString()),
          category: (['report', 'graphic', 'content', 'brand', 'general'].includes(String(f.category))
            ? (f.category as FileItem['category'])
            : 'general'),
          file_url: String(f.file_url ?? ''),
        },
      ]);
      setSelectedFile(null);
      setUploadDisplayName('');
      setUploadCategory('general');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Handle file deletion
  const handleDelete = async (fileId: string) => {
    setDeletingId(fileId);
    try {
      const res = await fetch('/api/dashboard/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: fileId }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(typeof errBody.error === 'string' ? errBody.error : 'Failed to delete file');
      }
      setFiles(files.filter(f => f.id !== fileId));
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file');
    } finally {
      setDeletingId(null);
    }
  };

  // Get category badge color
  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'report':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'graphic':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'content':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'brand':
        return 'bg-accent-soft text-accent border border-accent/20';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-brand-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-serif text-brand-text mb-2">Document Vault</h1>
        <p className="text-brand-muted">View and manage shared files with your Sunday Harmony team.</p>
      </div>

      {error && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-700">
          {error}
        </div>
      )}

      {/* Upload Section */}
      <div className="mb-8 bg-white border border-brand-border rounded-2xl p-6">
        <h2 className="text-lg font-serif text-brand-text mb-4">Upload a File</h2>
        <div className="space-y-4">
          <div className="border-2 border-dashed border-brand-border rounded-lg p-8 text-center hover:border-accent/50 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-accent hover:text-accent/80 font-medium transition-colors"
            >
              Click to select a file
            </button>
            <p className="text-brand-muted text-sm mt-2">or drag and drop</p>
          </div>

          {selectedFile && (
            <div className="space-y-3 bg-accent-soft border border-accent/20 rounded-lg p-4">
              <div>
                <p className="text-brand-text font-medium">{selectedFile.name}</p>
                <p className="text-brand-muted text-sm mt-1">{formatFileSize(selectedFile.size)}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-brand-muted mb-1">Display name (optional)</label>
                <input
                  type="text"
                  value={uploadDisplayName}
                  onChange={(e) => setUploadDisplayName(e.target.value)}
                  maxLength={300}
                  placeholder="Defaults to file name"
                  className="w-full py-2 px-3 rounded-lg border border-brand-border text-sm text-brand-text bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-brand-muted mb-1">Category</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as FileItem['category'])}
                  className="w-full py-2 px-3 rounded-lg border border-brand-border text-sm text-brand-text bg-white"
                >
                  <option value="general">General</option>
                  <option value="report">Report</option>
                  <option value="graphic">Graphic</option>
                  <option value="content">Content</option>
                  <option value="brand">Brand Assets</option>
                </select>
              </div>
            </div>
          )}

          {selectedFile && (
            <div className="flex gap-3">
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="px-4 py-2 bg-brand-text text-white font-medium rounded-lg hover:bg-brand-text/90 transition-colors disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Upload File'}
              </button>
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setUploadDisplayName('');
                  setUploadCategory('general');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="px-4 py-2 border border-brand-border text-brand-text font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          <p className="text-brand-muted text-sm">
            Max 4 MB per file (PDF, images, Word, Excel, CSV, text, or zip). Files are stored securely for your account.
          </p>
        </div>
      </div>

      {/* Files List */}
      <div className="bg-white border border-brand-border rounded-2xl p-6">
        <h2 className="text-lg font-serif text-brand-text mb-6">Shared Files</h2>

        {files.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-3xl mb-3">📁</p>
            <p className="text-brand-muted">No files shared yet. Your team will upload reports and deliverables here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-brand-border">
                  <th className="px-4 py-3 text-brand-text font-serif text-sm">File Name</th>
                  <th className="px-4 py-3 text-brand-text font-serif text-sm">Type</th>
                  <th className="px-4 py-3 text-brand-text font-serif text-sm">Size</th>
                  <th className="px-4 py-3 text-brand-text font-serif text-sm">Category</th>
                  <th className="px-4 py-3 text-brand-text font-serif text-sm">Uploaded By</th>
                  <th className="px-4 py-3 text-brand-text font-serif text-sm">Date</th>
                  <th className="px-4 py-3 text-brand-text font-serif text-sm">Link</th>
                  <th className="px-4 py-3 text-brand-text font-serif text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id} className="border-b border-brand-border/30 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-4 text-brand-text">{file.name}</td>
                    <td className="px-4 py-4 text-brand-muted text-sm">{file.type}</td>
                    <td className="px-4 py-4 text-brand-muted text-sm">{formatFileSize(file.size)}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getCategoryColor(file.category)}`}>
                        {file.category}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-brand-muted text-sm">{file.uploaded_by}</td>
                    <td className="px-4 py-4 text-brand-muted text-sm">{formatDate(file.created_at)}</td>
                    <td className="px-4 py-4">
                      {file.file_url ? (
                        <a
                          href={file.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent text-sm font-medium hover:underline"
                        >
                          Open
                        </a>
                      ) : (
                        <span className="text-brand-muted text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {deleteConfirm === file.id ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDelete(file.id)}
                            disabled={deletingId === file.id}
                            className="px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded hover:bg-red-200 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-3 py-1 bg-gray-100 text-brand-muted text-xs font-medium rounded hover:bg-gray-200 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(file.id)}
                          className="px-3 py-1 text-red-600 hover:text-red-700 text-xs font-medium transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
