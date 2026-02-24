import { aboutValues, team } from '@/lib/data'

export default function About() {
  return (
    <>
      {/* About Section */}
      <section className="py-24" id="about">
        <div className="max-w-[1100px] mx-auto px-7">
          <div className="section-label">About Us</div>
          <h2 className="font-serif text-[clamp(32px,5vw,52px)] font-extrabold leading-[1.12] text-brand-text mb-5">
            We&apos;re the partner <span className="gold-text">you&apos;ve been looking for</span>
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center mt-12">
            <div>
              <h3 className="font-serif text-[28px] font-bold text-brand-text mb-4">
                Marketing shouldn&apos;t feel like a mystery
              </h3>
              <p className="text-[15px] text-brand-muted mb-4 leading-relaxed">
                At Sunday Harmony, we understand the challenges NJ small businesses face. You know you need marketing, but you&apos;re too busy running your business to figure it all out &mdash; and the last agency you tried left you feeling ignored and confused.
              </p>
              <p className="text-[15px] text-brand-muted mb-7 leading-relaxed">
                We&apos;re different. We speak plain English, we prove our ROI, and we treat every client like our only client. We&apos;re your local marketing partner, not a faceless agency.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {aboutValues.map((val) => (
                  <div key={val.title} className="bg-brand-card border border-brand-border rounded-xl p-4">
                    <div className="text-xl mb-2">{val.icon}</div>
                    <h4 className="text-sm font-bold text-brand-text mb-1">{val.title}</h4>
                    <p className="text-xs text-brand-dim leading-snug">{val.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-brand-card border border-brand-border rounded-[20px] overflow-hidden aspect-square flex items-center justify-center">
              <div className="w-full h-full bg-gradient-to-br from-[#12121e] via-[#1a1520] to-[#161a25] flex flex-col items-center justify-center p-10">
                <div className="font-serif text-[80px] font-extrabold bg-gradient-to-br from-brand-gold-light to-brand-gold bg-clip-text text-transparent mb-4 leading-none">
                  SH
                </div>
                <div className="text-[13px] font-bold tracking-[0.2em] uppercase text-brand-dim">
                  Sunday Harmony
                </div>
                <div className="text-xs text-brand-dim mt-2 tracking-[0.1em]">
                  EST. 2023 &bull; New Jersey
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-24 pt-0">
        <div className="max-w-[1100px] mx-auto px-7">
          <div className="section-label">Our Team</div>
          <h2 className="font-serif text-[clamp(32px,5vw,52px)] font-extrabold leading-[1.12] text-brand-text mb-5">
            The people behind <span className="gold-text">your growth</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-12 max-w-[700px]">
            {team.map((member) => (
              <div key={member.name} className="bg-brand-card border border-brand-border rounded-2xl p-8 text-center transition-all hover:border-[rgba(201,169,110,0.15)]">
                <div className="w-20 h-20 rounded-full mx-auto mb-4 bg-gradient-to-br from-[rgba(201,169,110,0.15)] to-[rgba(201,169,110,0.05)] border-2 border-[rgba(201,169,110,0.2)] flex items-center justify-center font-serif text-[28px] font-extrabold text-brand-gold">
                  {member.initials}
                </div>
                <h4 className="text-[17px] font-bold text-brand-text mb-1">{member.name}</h4>
                <div className="text-xs font-semibold text-brand-gold mb-3 tracking-wide">{member.role}</div>
                <p className="text-[13px] text-brand-muted leading-relaxed">{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
