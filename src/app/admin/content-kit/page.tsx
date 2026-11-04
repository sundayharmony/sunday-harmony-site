'use client'

import { useState } from 'react'
import { salesMaterials, socialPostTemplates, type SocialPostTemplate } from '@/lib/sales-materials'

export default function ContentKitPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedPost, setExpandedPost] = useState<string | null>(null)

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const socialMaterial = salesMaterials.find(m => m.id === 'social-posts')

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Content Kit</h1>
        <p className="text-sm text-brand-muted">
          Social media posts with captions, hashtags, and design direction.
        </p>
      </div>

      {/* Download PDF section */}
      {socialMaterial && (
        <div className="rounded-xl border border-brand-border bg-white p-5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-brand-text">{socialMaterial.title}</h3>
              <p className="text-sm text-brand-muted mt-1">{socialMaterial.description}</p>
            </div>
            <div className="flex gap-2">
              <a
                href={socialMaterial.pdfPath}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold px-4 py-2 rounded-lg border border-brand-border hover:bg-neutral-50 transition-colors"
              >
                View PDF
              </a>
              <a
                href={socialMaterial.pdfPath}
                download
                className="text-xs font-semibold px-4 py-2 rounded-lg bg-brand-text text-white hover:bg-neutral-800 transition-colors"
              >
                Download
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Brand rules reminder */}
      <div className="rounded-xl border border-accent/30 bg-accent-soft/30 p-5 mb-6">
        <h3 className="font-bold text-brand-text mb-3">Brand Rules</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="w-12 h-12 rounded-lg mx-auto mb-2" style={{ backgroundColor: '#0A0A0A' }}></div>
            <div className="text-xs font-semibold">Ink #0A0A0A</div>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-lg mx-auto mb-2" style={{ backgroundColor: '#B8943F' }}></div>
            <div className="text-xs font-semibold">Gold #B8943F</div>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-lg mx-auto mb-2 border border-brand-border" style={{ backgroundColor: '#F0EBE3' }}></div>
            <div className="text-xs font-semibold">Cream #F0EBE3</div>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-lg mx-auto mb-2 border border-brand-border" style={{ backgroundColor: '#FFFFFF' }}></div>
            <div className="text-xs font-semibold">White #FFFFFF</div>
          </div>
        </div>
        <ul className="text-xs text-brand-muted space-y-1">
          <li>• Type: Cormorant Garamond (serif) for headlines; Montserrat for labels and body</li>
          <li>• Size: 1080×1350 (4:5) for feed posts; keep text within center 1080×1080 for grid previews</li>
          <li>• Voice: Plain English, calm, confident. No jargon, no vanity metrics. Lead with the free audit.</li>
        </ul>
      </div>

      {/* Posts grid */}
      <h2 className="font-bold text-brand-text mb-4">10 Posts</h2>
      <div className="space-y-4">
        {socialPostTemplates.map(post => (
          <SocialPostCard
            key={post.id}
            post={post}
            expanded={expandedPost === post.id}
            onToggle={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
            copiedId={copiedId}
            onCopy={copyToClipboard}
          />
        ))}
      </div>
    </div>
  )
}

function SocialPostCard({
  post,
  expanded,
  onToggle,
  copiedId,
  onCopy,
}: {
  post: SocialPostTemplate
  expanded: boolean
  onToggle: () => void
  copiedId: string | null
  onCopy: (text: string, id: string) => void
}) {
  return (
    <div className="rounded-xl border border-brand-border bg-white overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-neutral-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-accent-soft text-accent font-bold text-sm">
            {post.number.toString().padStart(2, '0')}
          </span>
          <div>
            <h3 className="font-bold text-brand-text">{post.title}</h3>
            <p className="text-xs text-brand-muted">{post.category} · {post.format}</p>
          </div>
        </div>
        <span className="text-brand-dim text-lg">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-brand-border pt-4 space-y-4">
          {/* Design direction */}
          <div>
            <div className="text-xs font-semibold text-brand-dim uppercase tracking-wide mb-2">Design Direction</div>
            <p className="text-sm text-brand-muted leading-relaxed">{post.designDirection}</p>
          </div>

          {/* Caption */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-brand-dim uppercase tracking-wide">Caption</div>
              <button
                onClick={() => onCopy(post.caption, `${post.id}-caption`)}
                className="text-xs font-semibold text-accent hover:underline"
              >
                {copiedId === `${post.id}-caption` ? 'Copied!' : 'Copy caption'}
              </button>
            </div>
            <pre className="text-sm bg-neutral-100 p-4 rounded-lg whitespace-pre-wrap font-sans text-brand-muted leading-relaxed">
              {post.caption}
            </pre>
          </div>

          {/* Hashtags */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-brand-dim uppercase tracking-wide">Hashtags</div>
              <button
                onClick={() => onCopy(post.hashtags, `${post.id}-hashtags`)}
                className="text-xs font-semibold text-accent hover:underline"
              >
                {copiedId === `${post.id}-hashtags` ? 'Copied!' : 'Copy hashtags'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {post.hashtags.split(' ').map((tag, i) => (
                <span key={i} className="text-xs bg-accent-soft text-accent px-2 py-1 rounded">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Copy all */}
          <button
            onClick={() => onCopy(`${post.caption}\n\n${post.hashtags}`, `${post.id}-all`)}
            className="w-full text-center text-sm font-semibold py-2.5 rounded-lg bg-brand-text text-white hover:bg-neutral-800 transition-colors"
          >
            {copiedId === `${post.id}-all` ? 'Copied!' : 'Copy Caption + Hashtags'}
          </button>
        </div>
      )}
    </div>
  )
}
