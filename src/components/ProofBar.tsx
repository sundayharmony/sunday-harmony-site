import { proofItems } from '@/lib/data'

export default function ProofBar() {
  return (
    <div className="py-12 border-t border-b border-brand-border">
      <div className="max-w-[1100px] mx-auto px-7">
        <div className="flex items-center justify-center gap-12 flex-wrap">
          {proofItems.map((item) => (
            <div
              key={item.label}
              className="text-[13px] font-semibold text-brand-dim tracking-[0.08em] uppercase flex items-center gap-2.5"
            >
              <span className="text-xl">{item.icon}</span>
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
