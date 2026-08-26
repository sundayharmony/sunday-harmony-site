'use client'

import DocumentUploadNotice from '@/components/credit-funding/DocumentUploadNotice'
import DocumentUploadCard from '@/components/credit-funding/DocumentUploadCard'
import type { DocumentStepItem } from '@/lib/credit-funding-document-steps'
import type { DocumentType } from '@/lib/credit-funding-types'
import type { StagedDocumentState } from '@/components/credit-funding/useStagedDocumentUploads'

interface DocumentUploadStepProps {
  title: string
  subtitle: string
  documents: DocumentStepItem[]
  uploads: Record<string, StagedDocumentState>
  docsOnFile?: string[]
  onUpload: (documentType: DocumentType, file: File) => Promise<void>
  onRemove: (documentType: DocumentType) => void
}

export default function DocumentUploadStep({
  title,
  subtitle,
  documents,
  uploads,
  docsOnFile = [],
  onUpload,
  onRemove,
}: DocumentUploadStepProps) {
  const requiredCount = documents.filter((d) => d.required).length
  const uploadedRequired = documents.filter(
    (d) => d.required && (uploads[d.type]?.status === 'uploaded' || docsOnFile.includes(d.type))
  ).length
  const totalUploaded = documents.filter(
    (d) => uploads[d.type]?.status === 'uploaded' || docsOnFile.includes(d.type)
  ).length

  return (
    <div>
      <DocumentUploadNotice />
      <div className="mb-5">
        <h3 className="font-serif text-lg font-bold text-brand-text">{title}</h3>
        <p className="text-sm text-brand-muted mt-1">{subtitle}</p>
        <p className="text-xs text-brand-dim mt-2">
          {uploadedRequired}/{requiredCount} required uploaded
          {documents.length > requiredCount ? ` · ${totalUploaded}/${documents.length} total` : ''}
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {documents.map((doc) => (
          <DocumentUploadCard
            key={doc.type}
            documentType={doc.type}
            label={doc.label}
            description={doc.description}
            icon={doc.icon}
            required={doc.required}
            onFile={docsOnFile.includes(doc.type)}
            state={uploads[doc.type]}
            onUpload={(file) => onUpload(doc.type, file)}
            onRemove={() => onRemove(doc.type)}
          />
        ))}
      </div>
    </div>
  )
}
