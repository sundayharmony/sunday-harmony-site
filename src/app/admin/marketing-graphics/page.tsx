import MarketingGraphicsEditor from '@/components/admin/marketing-graphics/MarketingGraphicsEditor'

export default function AdminMarketingGraphicsPage() {
  return (
    <div className="max-w-[1600px]">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-extrabold text-brand-text mb-2">Marketing Graphics</h1>
        <p className="text-sm text-brand-muted max-w-2xl">
          Create on-brand social posts, web assets, and print graphics using Sunday Harmony templates.
          Edit copy, preview live, and download PNG files ready to publish.
        </p>
      </div>
      <MarketingGraphicsEditor />
    </div>
  )
}
