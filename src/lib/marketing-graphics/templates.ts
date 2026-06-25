import { heroStats, packages, services, siteConfig } from '@/lib/data'
import type { GraphicCopy, GraphicPreset, GraphicTemplateMeta } from './types'

export const GRAPHIC_TEMPLATES: GraphicTemplateMeta[] = [
  {
    id: 'heroQuote',
    label: 'Hero Quote',
    description: 'Badge, headline, accent line, subtext, and CTA',
  },
  {
    id: 'ctaBlock',
    label: 'CTA Block',
    description: 'Centered headline with accent word and call-to-action',
  },
  {
    id: 'serviceSpotlight',
    label: 'Service Spotlight',
    description: 'Highlight a single service offering',
  },
  {
    id: 'statProof',
    label: 'Stat Proof',
    description: '2–3 proof stats with gold accents',
  },
  {
    id: 'packagePromo',
    label: 'Package Promo',
    description: 'Package tier, price, and tagline',
  },
]

export const DEFAULT_COPY: Record<string, GraphicCopy> = {
  heroQuote: {
    badge: siteConfig.tagline,
    headline: 'Stop guessing at marketing.',
    accentPhrase: 'Start growing with clarity.',
    body: 'We help New Jersey small businesses get found online, generate better leads, and grow revenue with one partner handling strategy, execution, and reporting.',
    ctaLabel: 'Get Your Free Audit →',
    footer: siteConfig.url.replace('https://', ''),
  },
  ctaBlock: {
    headline: 'Ready to stop doing it all',
    accentPhrase: 'yourself?',
    body: "Get a free audit of your online presence — we'll show you exactly what's working, what's not, and how to fix it.",
    ctaLabel: 'Get Your Free Audit →',
    footer: siteConfig.email,
  },
  serviceSpotlight: {
    icon: services[0]?.icon ?? '📈',
    headline: services[0]?.title ?? 'Local SEO',
    body: services[0]?.description ?? '',
    footer: siteConfig.url.replace('https://', ''),
  },
  statProof: {
    headline: 'Why Sunday Harmony?',
    stat1Value: heroStats[0]?.value ?? '14.3%',
    stat1Label: heroStats[0]?.label ?? 'Industry CAGR Growth',
    stat2Value: heroStats[1]?.value ?? '96%',
    stat2Label: heroStats[1]?.label ?? 'SMBs Plan to Advertise',
    stat3Value: heroStats[2]?.value ?? '54%',
    stat3Label: heroStats[2]?.label ?? 'Owners Do Marketing Solo',
    footer: siteConfig.tagline,
  },
  packagePromo: {
    tier: packages[2]?.tier ?? 'Growth',
    headline: packages[2]?.tagline ?? 'Start Generating Leads',
    price: `$${packages[2]?.price ?? 1800}/mo`,
    body: packages[2]?.ideal ?? 'For established businesses ready to invest in real growth.',
    ctaLabel: 'See Packages →',
    footer: siteConfig.url.replace('https://', ''),
  },
}

export function getDefaultCopy(templateId: string): GraphicCopy {
  return { ...(DEFAULT_COPY[templateId] ?? DEFAULT_COPY.heroQuote) }
}

export const GRAPHIC_PRESETS: GraphicPreset[] = [
  {
    id: 'hero-default',
    label: 'Hero copy (homepage)',
    templateId: 'heroQuote',
    copy: DEFAULT_COPY.heroQuote,
  },
  {
    id: 'cta-default',
    label: 'CTA banner copy',
    templateId: 'ctaBlock',
    copy: DEFAULT_COPY.ctaBlock,
  },
  ...services.map((s, i) => ({
    id: `service-${i}`,
    label: `Service: ${s.title}`,
    templateId: 'serviceSpotlight' as const,
    copy: {
      icon: s.icon,
      headline: s.title,
      body: s.description,
      footer: siteConfig.url.replace('https://', ''),
    },
  })),
  ...packages.map((p, i) => ({
    id: `package-${i}`,
    label: `Package: ${p.tier}`,
    templateId: 'packagePromo' as const,
    copy: {
      tier: p.tier,
      headline: p.tagline,
      price: `$${p.price}/mo`,
      body: p.ideal,
      ctaLabel: 'See Packages →',
      footer: siteConfig.url.replace('https://', ''),
    },
  })),
]

export function presetsForTemplate(templateId: string): GraphicPreset[] {
  return GRAPHIC_PRESETS.filter((p) => p.templateId === templateId)
}
