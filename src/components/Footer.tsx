export default function Footer() {
  return (
    <footer className="py-12 pb-8 border-t border-brand-border">
      <div className="max-w-[1100px] mx-auto px-7">
        <div className="flex justify-between items-center flex-wrap gap-5">
          <div className="font-serif text-lg font-bold text-brand-text">
            Sunday <span className="text-brand-gold">Harmony</span>
          </div>
          <div className="flex gap-7">
            {['Services', 'Packages', 'About', 'Contact'].map((link) => (
              <a
                key={link}
                href={`#${link.toLowerCase()}`}
                className="text-[13px] text-brand-dim hover:text-brand-gold transition-colors"
              >
                {link}
              </a>
            ))}
          </div>
        </div>
        <div className="text-center mt-8 pt-6 border-t border-brand-border text-xs text-brand-dim">
          &copy; {new Date().getFullYear()} Sunday Harmony. All rights reserved. &bull; New Jersey&apos;s All-in-One Marketing Partner
        </div>
      </div>
    </footer>
  )
}
