import Link from 'next/link'

type Variant = 'primary' | 'nav' | 'inline' | 'mobile'

interface Props {
  variant?: Variant
  href?: string
  className?: string
  onClick?: () => void
}

const styles: Record<Variant, string> = {
  primary:
    'inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-brand-text text-white text-sm font-semibold hover:-translate-y-0.5 hover:bg-neutral-800 transition-all',
  nav: 'shrink-0 px-4 lg:px-5 xl:px-6 py-2 lg:py-2.5 rounded-md bg-brand-text text-white font-semibold text-[11px] lg:text-[12px] xl:text-[13px] hover:bg-neutral-800 transition-all whitespace-nowrap',
  inline:
    'flex w-full items-center justify-center gap-2 rounded-xl border border-brand-border bg-accent-soft px-4 py-3.5 text-sm font-semibold text-brand-text transition-all hover:bg-neutral-100 hover:-translate-y-0.5',
  mobile: 'text-lg font-semibold text-accent py-4',
}

const labels: Record<Variant, string> = {
  primary: 'Get Your Free Audit →',
  nav: 'Free Audit',
  inline: 'Request your free audit',
  mobile: 'Get Your Free Audit',
}

export default function AuditCtaButton({ variant = 'primary', href, className = '', onClick }: Props) {
  const resolvedHref = href ?? (variant === 'primary' || variant === 'inline' ? '#contact' : '/#contact')
  const label = labels[variant]
  const classes = `${styles[variant]} ${className}`

  if (variant === 'nav' || variant === 'mobile') {
    return (
      <Link href={resolvedHref} onClick={onClick} className={classes}>
        {label}
      </Link>
    )
  }

  if (resolvedHref.startsWith('#')) {
    return (
      <a href={resolvedHref} onClick={onClick} className={classes}>
        {label}
        {variant === 'inline' && <span aria-hidden className="text-accent">→</span>}
      </a>
    )
  }

  return (
    <Link href={resolvedHref} onClick={onClick} className={classes}>
      {label}
    </Link>
  )
}
