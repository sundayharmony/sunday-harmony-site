import Link from 'next/link'

const paths = [
  {
    eyebrow: 'Consulting',
    title: 'Build the business',
    body: 'Brand, strategy, and the systems the company runs on.',
    href: '/services',
    primary: true,
  },
  {
    eyebrow: 'Business funding',
    title: 'Fund the business',
    body: 'Capital for owners who are ready for the next step.',
    href: '/funding',
    primary: false,
  },
  {
    eyebrow: 'Personal credit',
    title: 'Strengthen personal credit',
    body: 'A clear read on your credit and a plan to improve creditworthiness.',
    href: '/credit?focus=credit',
    primary: false,
  },
] as const

export default function HarmonyPaths() {
  return (
    <section className="py-16 bg-white" id="paths" aria-labelledby="harmony-paths-heading">
      <div className="max-w-[1100px] mx-auto px-7">
        <h2 id="harmony-paths-heading" className="sr-only">
          Choose a path
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {paths.map((path) => (
            <Link
              key={path.title}
              href={path.href}
              className={`block rounded-2xl border bg-white p-7 transition-all hover:shadow-sm hover:-translate-y-0.5 ${
                path.primary ? 'border-brand-text' : 'border-brand-border hover:border-neutral-300'
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-dim">{path.eyebrow}</p>
                {path.primary ? (
                  <span className="shrink-0 px-2.5 py-1 rounded-full bg-accent-soft border border-brand-border text-[10px] font-bold tracking-wide text-accent">
                    Main practice
                  </span>
                ) : null}
              </div>
              <h3 className="font-serif text-[26px] font-extrabold text-brand-text leading-tight mb-2">{path.title}</h3>
              <p className="text-sm text-brand-muted leading-relaxed">{path.body}</p>
            </Link>
          ))}
        </div>
        <p className="mt-6 text-sm text-brand-dim">
          Owners who need funding, and people who want a clear read on their credit.
        </p>
      </div>
    </section>
  )
}
