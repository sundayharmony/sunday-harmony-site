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
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Fetch files
  useEffect(() => {
    const controller = new AbortController();
    const fetchFiles = async () => {
      try {
        const res = await fetch('/api/dashboard/files', { signal: controller.signal });
        if (!res.ok) throw new Error('Failed to fetch files');
        const result = await res.json();
        setFiles(Array.isArray(result) ? result : (result.data || []));
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'An error occurred');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
    return () => controller.abort();
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
    return new Date(dateString).toLocaleDateString('en-US', {
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
    try {
      // For now, just show placeholder
      setError('');
      // In the future, this will upload to Supabase Storage
      setError('File upload will be available once storage is configured. Contact your admin.');
      setSelectedFile(null);
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

      if (!res.ok) throw new Error('Failed to delete file');
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
        return 'bg-[rgba(184,148,63,0.08)] text-brand-gold border border-brand-gold/20';
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
          <div className="border-2 border-dashed border-brand-border rounded-lg p-8 text-center hover:border-brand-gold/50 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-brand-gold hover:text-brand-gold/80 font-medium transition-colors"
            >
              Click to select a file
            </button>
            <p className="text-brand-muted text-sm mt-2">or drag and drop</p>
          </div>

          {selectedFile && (
            <div className="bg-[rgba(184,148,63,0.08)] border border-brand-gold/20 rounded-lg p-4">
              <p className="text-brand-text font-medium">{selectedFile.name}</p>
              <p className="text-brand-muted text-sm mt-1">{formatFileSize(selectedFile.size)}</p>
            </div>
          )}

          {selectedFile && (
            <div className="flex gap-3">
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="px-4 py-2 bg-brand-gold text-white font-medium rounded-lg hover:bg-brand-gold/90 transition-colors disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Upload File'}
              </button>
              <button
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="px-4 py-2 border border-brand-border text-brand-text font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          <p className="text-brand-muted text-sm">
            File upload will be available once storage is configured. Contact your admin.
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
     