'use client';

import { useEffect, useState } from 'react';

interface Approval {
  id: string;
  title: string;
  content_type: 'post' | 'email' | 'image' | 'video' | 'article' | 'ad' | 'other';
  description: string;
  admin_notes: string;
  content_url?: string;
  content_text?: string;
  status: 'pending' | 'approved' | 'revision_requested';
  client_feedback?: string;
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Fetch approvals
  useEffect(() => {
    const fetchApprovals = async () => {
      try {
        const res = await fetch('/api/dashboard/approvals');
        if (!res.ok) throw new Error('Failed to fetch approvals');
        const result = await res.json();
        setApprovals(Array.isArray(result) ? result : (result.data || []));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchApprovals();
  }, []);

  // Filter approvals
  const filteredApprovals = activeTab === 'pending'
    ? approvals.filter(a => a.status === 'pending')
    : approvals;

  // Get content type color
  const getContentTypeColor = (type: string): string => {
    switch (type) {
      case 'post':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'email':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'image':
        return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'video':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'article':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'ad':
        return 'bg-accent-soft text-accent border-accent/20';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get status badge color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'revision_requested':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'pending':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Handle approval
  const handleApprove = async (id: string) => {
    setSubmittingId(id);
    try {
      const res = await fetch('/api/dashboard/approvals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status: 'approved',
        }),
      });

      if (!res.ok) throw new Error('Failed to approve');
      setApprovals(approvals.map(a =>
        a.id === id ? { ...a, status: 'approved' } : a
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setSubmittingId(null);
    }
  };

  // Handle revision request
  const handleRequestRevision = async (id: string) => {
    if (!feedbackText.trim()) {
      setError('Please provide feedback');
      return;
    }

    setSubmittingId(id);
    try {
      const res = await fetch('/api/dashboard/approvals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status: 'revision_requested',
          client_feedback: feedbackText,
        }),
      });

      if (!res.ok) throw new Error('Failed to request revision');
      setApprovals(approvals.map(a =>
        a.id === id ? { ...a, status: 'revision_requested', client_feedback: feedbackText } : a
      ));
      setFeedbackId(null);
      setFeedbackText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request revision');
    } finally {
      setSubmittingId(null);
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
        <h1 className="text-3xl font-serif text-brand-text mb-2">Content Approvals</h1>
        <p className="text-brand-muted">Review and approve content created by your Sunday Harmony team.</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-brand-border">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'pending'
              ? 'border-accent text-accent'
              : 'border-transparent text-brand-muted hover:text-brand-text'
          }`}
        >
          Pending Review
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'all'
              ? 'border-accent text-accent'
              : 'border-transparent text-brand-muted hover:text-brand-text'
          }`}
        >
          All
        </button>
      </div>

      {/* Approvals List */}
      {filteredApprovals.length === 0 ? (
        <div className="bg-white border border-brand-border rounded-2xl p-12 text-center">
          <p className="text-3xl mb-3">✓</p>
          <p className="text-brand-muted">No content waiting for your approval.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredApprovals.map((approval) => (
            <div key={approval.id} className="bg-white border border-brand-border rounded-2xl p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-brand-text font-serif text-lg mb-2">{approval.title}</h3>
                  <div className="flex gap-2 flex-wrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getContentTypeColor(approval.content_type)}`}>
                      {approval.content_type}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(approval.status)}`}>
                      {approval.status === 'approved' ? 'Approved' : approval.status === 'revision_requested' ? 'Revision Requested' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              {approval.description && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-brand-text text-sm">{approval.description}</p>
                </div>
              )}

              {/* Content Preview */}
              {approval.content_text && (
                <div className="mb-4 p-4 bg-accent-soft border border-accent/20 rounded-lg">
                  <p className="text-xs text-accent font-medium mb-2">CONTENT PREVIEW</p>
                  <p className="text-brand-text text-sm whitespace-pre-wrap line-clamp-6">{approval.content_text}</p>
                </div>
              )}

              {/* Admin Notes */}
              {approval.admin_notes && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-700 font-medium mb-2">TEAM NOTES</p>
                  <p className="text-blue-900 text-sm">{approval.admin_notes}</p>
                </div>
              )}

              {/* Client Feedback (for revision requested) */}
              {approval.client_feedback && approval.status === 'revision_requested' && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-700 font-medium mb-2">YOUR FEEDBACK</p>
                  <p className="text-amber-900 text-sm">{approval.client_feedback}</p>
                </div>
              )}

              {/* Content URL Link */}
              {approval.content_url && (
                <div className="mb-4">
                  <a
                    href={approval.content_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent/80 font-medium text-sm transition-colors"
                  >
                    View Content →
                  </a>
                </div>
              )}

              {/* Actions */}
              {approval.status === 'pending' && (
                <div className="space-y-4">
                  {feedbackId !== approval.id && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleApprove(approval.id)}
                        disabled={submittingId === approval.id}
                        className="flex-1 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {submittingId === approval.id ? 'Approving...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => setFeedbackId(approval.id)}
                        className="flex-1 px-4 py-2 bg-amber-100 text-amber-800 font-medium rounded-lg hover:bg-amber-200 transition-colors"
                      >
                        Request Revision
                      </button>
                    </div>
                  )}

                  {feedbackId === approval.id && (
                    <div className="space-y-3">
                      <textarea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="What would you like revised? Be specific with your feedback..."
                        rows={4}
                        className="w-full px-4 py-3 border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 text-brand-text placeholder:text-brand-dim"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRequestRevision(approval.id)}
                          disabled={submittingId === approval.id || !feedbackText.trim()}
                          className="flex-1 px-4 py-2 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
                        >
                          {submittingId === approval.id ? 'Submitting...' : 'Submit Feedback'}
                        </button>
                        <button
                          onClick={() => {
                            setFeedbackId(null);
                            setFeedbackText('');
                          }}
                          className="flex-1 px-4 py-2 border border-brand-border text-brand-text font-medium rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {approval.status === 'approved' && (
                <div className="flex items-center gap-2 text-green-600">
                  <span className="text-lg">✓</span>
                  <span className="font-medium">You approved this content</span>
                </div>
              )}

              {approval.status === 'revision_requested' && (
                <div className="flex items-center gap-2 text-amber-600">
                  <span className="text-lg">⟳</span>
                  <span className="font-medium">Awaiting revised version</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
