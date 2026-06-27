'use client'

import type { DragEvent, ReactNode } from 'react'
import { useRef, useState } from 'react'

interface Props {
  onFile: (file: File) => void
  accept?: string
  disabled?: boolean
  clickToSelect?: boolean
  children?: ReactNode
  className?: string
  activeClassName?: string
}

export default function FileDropzone({
  onFile,
  accept,
  disabled,
  clickToSelect,
  children,
  className = 'border-2 border-dashed rounded-xl p-5 transition-colors cursor-pointer border-brand-border hover:border-accent/50',
  activeClassName = 'border-accent bg-accent-soft/30',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleDrag = (e: DragEvent, over: boolean) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return
    setDragOver(over)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    if (disabled) return
    const file = e.dataTransfer.files?.[0]
    if (file) onFile(file)
  }

  const handleClick = () => {
    if (disabled || !clickToSelect) return
    inputRef.current?.click()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFile(file)
    e.target.value = ''
  }

  return (
    <div
      className={`${className} ${dragOver ? activeClassName : ''} ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
      onDragOver={(e) => handleDrag(e, true)}
      onDragLeave={(e) => handleDrag(e, false)}
      onDrop={handleDrop}
      onClick={clickToSelect ? handleClick : undefined}
      role={clickToSelect ? 'button' : undefined}
      tabIndex={clickToSelect && !disabled ? 0 : undefined}
      onKeyDown={
        clickToSelect
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleClick()
              }
            }
          : undefined
      }
    >
      {clickToSelect && (
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={handleInputChange}
          disabled={disabled}
        />
      )}
      {children}
    </div>
  )
}
