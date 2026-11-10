export type MarketingImageSection =
  | 'business-essentials'
  | 'business-launch'
  | 'marketing-partner'
  | 'custom-solutions'
  | 'where-to-find-prospects'

export type MarketingImage = {
  section: MarketingImageSection
  src: string
  alt: string
  width: number
  height: number
}

export const marketingImageSections = [
  { id: 'business-essentials' as const, label: 'Business Essentials' },
  { id: 'business-launch' as const, label: 'Business Launch' },
  { id: 'marketing-partner' as const, label: 'Marketing Partner' },
  { id: 'custom-solutions' as const, label: 'Custom Solutions' },
  { id: 'where-to-find-prospects' as const, label: 'Where to find prospects' },
] as const

export const marketingImages: MarketingImage[] = [
  { section: 'business-essentials', src: '/marketing/business-essentials/01-kraft-ivory-stationery.webp', alt: "Kraft and ivory stationery arranged as a brand kit", width: 1152, height: 864 },
  { section: 'business-essentials', src: '/marketing/business-essentials/02-wood-surface-stationery.webp', alt: "Stationery set on a wood surface", width: 1152, height: 864 },
  { section: 'business-essentials', src: '/marketing/business-essentials/03-geometric-stationery.webp', alt: "Colorful geometric stationery spread", width: 1024, height: 1024 },
  { section: 'business-essentials', src: '/marketing/business-essentials/04-dark-luxury-kit.webp', alt: "Dark luxury stationery kit", width: 1152, height: 864 },
  { section: 'business-essentials', src: '/marketing/business-essentials/05-minimal-logo-mark.webp', alt: "Minimal logo and brand mark samples", width: 1152, height: 864 },
  { section: 'business-essentials', src: '/marketing/business-essentials/06-professional-letterhead.webp', alt: "Professional letterhead package", width: 1024, height: 1024 },
  { section: 'business-essentials', src: '/marketing/business-essentials/07-gold-line-signage.webp', alt: "Gold line mark on a dark field", width: 1024, height: 1024 },
  { section: 'business-essentials', src: '/marketing/business-essentials/08-minimal-guidelines-spread.webp', alt: "Minimal brand guidelines spread", width: 1152, height: 864 },
  { section: 'business-essentials', src: '/marketing/business-essentials/09-soft-logo-system.webp', alt: "Soft minimal logo system", width: 1024, height: 1024 },
  { section: 'business-essentials', src: '/marketing/business-essentials/10-open-guidelines-book.webp', alt: "Open brand guidelines book", width: 1152, height: 864 },
  { section: 'business-essentials', src: '/marketing/business-essentials/11-guidelines-presentation.webp', alt: "Brand guidelines presentation pages", width: 1152, height: 864 },
  { section: 'business-essentials', src: '/marketing/business-essentials/12-editing-quick-guide.webp', alt: "Brand editing guide on a desk", width: 1024, height: 1024 },
  { section: 'business-essentials', src: '/marketing/business-essentials/13-identity-package-stack.webp', alt: "Identity package stack", width: 1152, height: 864 },
  { section: 'business-essentials', src: '/marketing/business-essentials/14-small-business-brand-board.webp', alt: "Small-business brand board", width: 1280, height: 720 },
  { section: 'business-essentials', src: '/marketing/business-essentials/15-logo-lockup-mockup.webp', alt: "Logo lockup mockup", width: 1152, height: 864 },
  { section: 'business-essentials', src: '/marketing/business-essentials/16-branding-kit-desk.webp', alt: "Branding kit on a desk", width: 1152, height: 864 },
  { section: 'business-essentials', src: '/marketing/business-essentials/17-corporate-identity-guide.webp', alt: "Corporate identity guide pages", width: 1280, height: 720 },
  { section: 'business-essentials', src: '/marketing/business-essentials/18-clean-branding-system.webp', alt: "Clean branding system layout", width: 1152, height: 864 },
  { section: 'business-essentials', src: '/marketing/business-essentials/19-modern-business-cards.webp', alt: "Modern business cards and stationery", width: 1152, height: 864 },
  { section: 'business-essentials', src: '/marketing/business-essentials/20-letterhead-layout.webp', alt: "Letterhead layout samples", width: 1152, height: 864 },
  { section: 'business-essentials', src: '/marketing/business-essentials/21-minimal-stationery-templates.webp', alt: "Minimal stationery templates", width: 1152, height: 864 },
  { section: 'business-essentials', src: '/marketing/business-essentials/22-modern-logo-system.webp', alt: "Modern logo system samples", width: 1152, height: 864 },
  { section: 'business-launch', src: '/marketing/business-launch/01-custom-website-mockup.webp', alt: "Custom website mockup on a screen", width: 1024, height: 1024 },
  { section: 'business-launch', src: '/marketing/business-launch/02-affordable-site-preview.webp', alt: "Affordable professional website preview", width: 1280, height: 720 },
  { section: 'business-launch', src: '/marketing/business-launch/03-responsive-site-layout.webp', alt: "Responsive website layout samples", width: 1024, height: 1024 },
  { section: 'business-launch', src: '/marketing/business-launch/04-service-site-grid.webp', alt: "Service business website grid", width: 1152, height: 864 },
  { section: 'business-launch', src: '/marketing/business-launch/05-corporate-site-design.webp', alt: "Corporate website design preview", width: 1024, height: 1024 },
  { section: 'business-launch', src: '/marketing/business-launch/06-agency-brand-web.webp', alt: "Creative agency brand and web mockup", width: 1152, height: 864 },
  { section: 'business-launch', src: '/marketing/business-launch/07-brand-bond-website.webp', alt: "Brand website homepage layout", width: 1152, height: 864 },
  { section: 'business-launch', src: '/marketing/business-launch/08-premium-agency-concept.webp', alt: "Premium agency website concept", width: 1152, height: 864 },
  { section: 'business-launch', src: '/marketing/business-launch/09-wordpress-site-build.webp', alt: "WordPress website build preview", width: 1280, height: 720 },
  { section: 'business-launch', src: '/marketing/business-launch/10-site-build-guide.webp', alt: "Website build guide pages", width: 1280, height: 720 },
  { section: 'business-launch', src: '/marketing/business-launch/11-web-app-preview.webp', alt: "Web and mobile app preview", width: 1280, height: 720 },
  { section: 'business-launch', src: '/marketing/business-launch/12-site-design-principles.webp', alt: "Website design principles board", width: 1280, height: 720 },
  { section: 'business-launch', src: '/marketing/business-launch/13-brand-guide-binder.webp', alt: "Comprehensive brand guide binder", width: 1280, height: 720 },
  { section: 'business-launch', src: '/marketing/business-launch/14-graphic-design-desk.webp', alt: "Graphic design desk with samples", width: 1152, height: 864 },
  { section: 'business-launch', src: '/marketing/business-launch/15-brand-builder-steps.webp', alt: "Five-step brand builder overview", width: 1280, height: 720 },
  { section: 'business-launch', src: '/marketing/business-launch/16-starter-kit-bundle.webp', alt: "Business starter kit bundle", width: 1024, height: 1024 },
  { section: 'business-launch', src: '/marketing/business-launch/17-style-guide-board.webp', alt: "Brand style guide board", width: 1152, height: 864 },
  { section: 'business-launch', src: '/marketing/business-launch/18-fintech-identity.webp', alt: "Fintech brand identity samples", width: 1152, height: 864 },
  { section: 'business-launch', src: '/marketing/business-launch/19-entrepreneur-branding.webp', alt: "Entrepreneur branding workspace", width: 1280, height: 720 },
  { section: 'business-launch', src: '/marketing/business-launch/20-web-dev-workspace.webp', alt: "Web development workspace", width: 1280, height: 720 },
  { section: 'marketing-partner', src: '/marketing/marketing-partner/01-social-ad-creative.webp', alt: "Social media ad creative set", width: 1280, height: 720 },
  { section: 'marketing-partner', src: '/marketing/marketing-partner/02-flyer-poster-set.webp', alt: "Flyer and poster designs", width: 1280, height: 720 },
  { section: 'marketing-partner', src: '/marketing/marketing-partner/03-print-flyer-stack.webp', alt: "Printed flyer stack", width: 1152, height: 864 },
  { section: 'marketing-partner', src: '/marketing/marketing-partner/04-digital-campaign-board.webp', alt: "Digital marketing campaign board", width: 1152, height: 864 },
  { section: 'marketing-partner', src: '/marketing/marketing-partner/05-search-ads-overview.webp', alt: "Search advertising overview", width: 1280, height: 720 },
  { section: 'marketing-partner', src: '/marketing/marketing-partner/06-social-publishing-desk.webp', alt: "Social publishing workspace", width: 1152, height: 864 },
  { section: 'marketing-partner', src: '/marketing/marketing-partner/07-social-services-spread.webp', alt: "Digital and social services spread", width: 1280, height: 720 },
  { section: 'marketing-partner', src: '/marketing/marketing-partner/08-automation-dashboard.webp', alt: "Marketing automation dashboard", width: 1280, height: 720 },
  { section: 'marketing-partner', src: '/marketing/marketing-partner/09-short-form-scheduling.webp', alt: "Short-form content scheduling board", width: 1280, height: 720 },
  { section: 'marketing-partner', src: '/marketing/marketing-partner/10-social-campaign-grid.webp', alt: "Social media campaign grid", width: 1280, height: 720 },
  { section: 'marketing-partner', src: '/marketing/marketing-partner/11-marketing-brand-system.webp', alt: "Marketing brand system samples", width: 1280, height: 720 },
  { section: 'marketing-partner', src: '/marketing/marketing-partner/12-transformation-insights.webp', alt: "Digital transformation insights board", width: 1152, height: 864 },
  { section: 'marketing-partner', src: '/marketing/marketing-partner/13-competitive-analysis.webp', alt: "Competitive analysis guide pages", width: 1280, height: 720 },
  { section: 'marketing-partner', src: '/marketing/marketing-partner/14-content-creation-set.webp', alt: "Content creation photo set", width: 1152, height: 864 },
  { section: 'marketing-partner', src: '/marketing/marketing-partner/15-local-seo-workspace.webp', alt: "Local SEO workspace", width: 1152, height: 864 },
  { section: 'custom-solutions', src: '/marketing/custom-solutions/01-logistics-print-kit.webp', alt: "Logistics print and data kit", width: 1024, height: 1024 },
  { section: 'custom-solutions', src: '/marketing/custom-solutions/02-vehicle-wrap-design.webp', alt: "Vehicle wrap design mockup", width: 1152, height: 864 },
  { section: 'custom-solutions', src: '/marketing/custom-solutions/03-corporate-print-suite.webp', alt: "Corporate print suite", width: 1152, height: 864 },
  { section: 'custom-solutions', src: '/marketing/custom-solutions/04-apparel-merch-rack.webp', alt: "Custom apparel and merchandise rack", width: 1024, height: 1024 },
  { section: 'custom-solutions', src: '/marketing/custom-solutions/05-food-brand-identity.webp', alt: "Food brand identity samples", width: 1280, height: 720 },
  { section: 'custom-solutions', src: '/marketing/custom-solutions/06-custom-apparel-display.webp', alt: "Custom apparel display", width: 1280, height: 720 },
  { section: 'custom-solutions', src: '/marketing/custom-solutions/07-construction-marketing.webp', alt: "Construction marketing materials", width: 1280, height: 720 },
  { section: 'custom-solutions', src: '/marketing/custom-solutions/08-event-rebrand-kit.webp', alt: "Event rebrand kit", width: 1280, height: 720 },
  { section: 'custom-solutions', src: '/marketing/custom-solutions/09-merchandise-display.webp', alt: "Merchandise and apparel display", width: 1024, height: 1024 },
  { section: 'custom-solutions', src: '/marketing/custom-solutions/10-b2b-print-materials.webp', alt: "B2B print marketing materials", width: 1152, height: 864 },
  { section: 'custom-solutions', src: '/marketing/custom-solutions/11-fleet-graphics.webp', alt: "Fleet graphics on a vehicle", width: 1280, height: 720 },
  { section: 'custom-solutions', src: '/marketing/custom-solutions/12-vehicle-wrap-shop.webp', alt: "Vehicle wrap shop samples", width: 1152, height: 864 },
  { section: 'custom-solutions', src: '/marketing/custom-solutions/13-promo-coasters.webp', alt: "Promotional coasters for venues", width: 1152, height: 864 },
  { section: 'custom-solutions', src: '/marketing/custom-solutions/14-restaurant-branding.webp', alt: "Restaurant branding guide", width: 1280, height: 720 },
  { section: 'custom-solutions', src: '/marketing/custom-solutions/15-admin-dashboard-ui.webp', alt: "Admin dashboard interface", width: 1152, height: 864 },
  { section: 'custom-solutions', src: '/marketing/custom-solutions/16-tailwind-dashboard.webp', alt: "Modern dashboard template", width: 1152, height: 864 },
  { section: 'custom-solutions', src: '/marketing/custom-solutions/17-brand-experience-event.webp', alt: "Brand experience event setup", width: 1280, height: 720 },
  { section: 'custom-solutions', src: '/marketing/custom-solutions/18-inflatable-event-room.webp', alt: "Custom inflatable event room", width: 1152, height: 864 },
  { section: 'where-to-find-prospects', src: '/marketing/where-to-find-prospects/01-networking-reception.webp', alt: "Networking reception seen from behind", width: 1280, height: 720 },
]

export function marketingImagesFor(section: MarketingImageSection): MarketingImage[] {
  return marketingImages.filter((image) => image.section === section)
}

export function featuredMarketingImage(section: MarketingImageSection): MarketingImage | undefined {
  return marketingImagesFor(section)[0]
}

export const marketingImageCounts = Object.fromEntries(
  marketingImageSections.map((section) => [section.id, marketingImagesFor(section.id).length])
) as Record<MarketingImageSection, number>
