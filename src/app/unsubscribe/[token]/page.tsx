import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

type Params = {
  params: Promise<{ token: string }>
  searchParams: Promise<{ done?: string; invalid?: string }>
}

export const metadata = {
  title: 'Unsubscribe',
  robots: { index: false, follow: false },
}

export default async function UnsubscribePage({ params, searchParams }: Params) {
  const { token } = await params
  const query = await searchParams
  const done = query.done === '1'
  const invalid = query.invalid === '1'
  const heading = done
    ? 'You are unsubscribed.'
    : invalid
      ? 'This link is not valid.'
      : 'Stop Sunday Harmony emails?'

  return (
    <>
      <Navbar />
      <main id="main" className="pt-[var(--nav-total-height)]">
        <section className="py-16 sm:py-20 bg-brand-bg-soft min-h-[60vh]">
          <div className="max-w-[32rem] mx-auto px-7">
            <p className="section-label">Email preferences</p>
            <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-brand-text mb-3">
              {heading}
            </h1>
            {done ? (
              <p className="text-sm text-brand-muted leading-relaxed">
                We will not send further outreach to this address. This page does not show your email
                address.
              </p>
            ) : invalid ? (
              <p className="text-sm text-brand-muted leading-relaxed">
                This unsubscribe link is not valid. Your address is not shown on this page, and this
                page does not require an account.
              </p>
            ) : (
              <>
                <p className="text-sm text-brand-muted leading-relaxed mb-6">
                  Confirm below to unsubscribe from Sunday Harmony Consulting outreach. This does not
                  require an account. Your address is not shown on this page.
                </p>
                <form method="post" action={`/api/unsubscribe/${encodeURIComponent(token)}`}>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-5 py-3 rounded-lg bg-brand-text text-white text-sm font-semibold"
                  >
                    Confirm unsubscribe
                  </button>
                </form>
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
