const GOLD = '#b8943f'
const INK = '#0a0a0a'
const CREAM = '#f0ebe3'

function IconFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className="h-14 w-14 shrink-0"
      role="img"
      aria-label={label}
    >
      <rect width="64" height="64" rx="16" fill={CREAM} stroke="rgba(10,10,10,0.12)" />
      {children}
    </svg>
  )
}

export function PersonIcon() {
  return (
    <IconFrame label="Person">
      <circle cx="32" cy="24" r="8" fill="none" stroke={INK} strokeWidth="2.5" />
      <path d="M16 50c2.5-10 10-14 16-14s13.5 4 16 14" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
    </IconFrame>
  )
}

export function BuildingIcon() {
  return (
    <IconFrame label="Business">
      <rect x="18" y="18" width="28" height="30" rx="3" fill="none" stroke={INK} strokeWidth="2.5" />
      <path d="M26 48V36h12v12" fill="none" stroke={GOLD} strokeWidth="2.5" />
      <path d="M24 26h4M36 26h4M24 32h4M36 32h4" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
    </IconFrame>
  )
}

export function GuaranteeIcon() {
  return (
    <IconFrame label="Personal promise to repay">
      <path
        d="M32 14l16 6v12c0 10-7 16-16 18-9-2-16-8-16-18V20l16-6z"
        fill="none"
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M24 33l6 6 12-12" fill="none" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </IconFrame>
  )
}

export function StepConnector({ direction }: { direction: 'down' | 'right' }) {
  const isDown = direction === 'down'
  return (
    <svg
      viewBox={isDown ? '0 0 24 28' : '0 0 36 24'}
      className={isDown ? 'mx-auto h-7 w-6' : 'h-6 w-9'}
      aria-hidden="true"
    >
      {isDown ? (
        <>
          <path d="M12 2v18" stroke={GOLD} strokeWidth="3" strokeLinecap="round" />
          <path d="M5 14l7 8 7-8" fill="none" stroke={GOLD} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <path d="M2 12h26" stroke={GOLD} strokeWidth="3" strokeLinecap="round" />
          <path d="M20 5l10 7-10 7" fill="none" stroke={GOLD} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  )
}

export function ToolkitStepPath({
  title,
  steps,
}: {
  title: string
  steps: ReadonlyArray<{ title: string; body: string }>
}) {
  return (
    <figure className="min-w-0">
      <figcaption className="mb-4 text-lg font-bold text-brand-text">{title}</figcaption>
      <ol className="flex min-w-0 flex-col md:flex-row md:items-stretch">
        {steps.map((step, index) => (
          <li key={step.title} className="flex min-w-0 flex-1 flex-col md:flex-row md:items-stretch">
            <article className="flex min-w-0 flex-1 flex-col rounded-2xl border border-brand-border bg-white p-5">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border-2 border-accent bg-accent-soft font-serif text-xl font-extrabold text-brand-text">
                <span className="sr-only">Step {index + 1}: </span>
                {index + 1}
              </div>
              <h3 className="text-xl font-bold text-brand-text">{step.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-brand-muted">{step.body}</p>
            </article>
            {index < steps.length - 1 ? (
              <div className="flex shrink-0 items-center justify-center py-1 md:px-1 md:py-0" aria-hidden="true">
                <span className="md:hidden">
                  <StepConnector direction="down" />
                </span>
                <span className="hidden md:inline">
                  <StepConnector direction="right" />
                </span>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </figure>
  )
}

export function ConnectionFlow() {
  const stages = [
    { title: 'Personal credit', body: 'The person’s borrowing history.', Icon: PersonIcon },
    { title: 'Personal guarantee', body: 'The person may have to repay if the business cannot.', Icon: GuaranteeIcon },
    { title: 'Business funding', body: 'Money for the company. Lenders still decide.', Icon: BuildingIcon },
  ] as const

  return (
    <figure className="min-w-0 rounded-2xl border border-brand-border bg-white p-5 sm:p-6">
      <figcaption className="mb-5 text-lg font-bold text-brand-text">How the pieces fit</figcaption>
      <ol className="flex min-w-0 flex-col md:flex-row md:items-stretch">
        {stages.map((stage, index) => (
          <li key={stage.title} className="flex min-w-0 flex-1 flex-col md:flex-row md:items-stretch">
            <article className="flex min-w-0 flex-1 flex-col items-start gap-3 rounded-2xl border border-brand-border bg-[#fbf9f4] p-5">
              <stage.Icon />
              <h3 className="text-xl font-bold text-brand-text">{stage.title}</h3>
              <p className="text-base leading-relaxed text-brand-muted">{stage.body}</p>
            </article>
            {index < stages.length - 1 ? (
              <div className="flex shrink-0 items-center justify-center py-1 md:px-1 md:py-0" aria-hidden="true">
                <span className="md:hidden">
                  <StepConnector direction="down" />
                </span>
                <span className="hidden md:inline">
                  <StepConnector direction="right" />
                </span>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="mt-5 rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 text-base font-semibold leading-relaxed text-brand-text">
        Stronger personal credit may help a review when a product uses a personal guarantee. It does not remove the risk. It does not guarantee funding.
      </p>
    </figure>
  )
}

export function DefinitionIcon({ id }: { id: 'personal-credit' | 'business-credit' | 'personal-guarantee' }) {
  if (id === 'personal-credit') return <PersonIcon />
  if (id === 'business-credit') return <BuildingIcon />
  return <GuaranteeIcon />
}
