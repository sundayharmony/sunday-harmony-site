import MarketingGraphicsEditor from '@/components/admin/marketing-graphics/MarketingGraphicsEditor'

export default function AdminMarketingGraphicsPage() {
  return (
    <div className="max-w-[1600px]">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Marketing Graphics</h1>
        <p className="text-sm text-brand-muted max-w-2xl">
          Create on-brand social posts, web assets, and print graphics. Use the template editor for pixel-perfect
          exports, or the Gemini tab to generate full ads or AI backgrounds with your exact copy and logo — always
          review before publishing.
        </p>
      </div>
      <MarketingGraphicsEditor />
    </div>
  )
}
