import type { GraphicTemplateId } from '@/lib/marketing-graphics/types'
import { CtaBlockGraphic } from './CtaBlockGraphic'
import { HeroQuoteGraphic } from './HeroQuoteGraphic'
import { PackagePromoGraphic } from './PackagePromoGraphic'
import { ServiceSpotlightGraphic } from './ServiceSpotlightGraphic'
import { StatProofGraphic } from './StatProofGraphic'
import type { TemplateRenderProps } from './shared'

export function GraphicTemplateRenderer(props: TemplateRenderProps & { templateId: GraphicTemplateId }) {
  switch (props.templateId) {
    case 'ctaBlock':
      return <CtaBlockGraphic {...props} />
    case 'serviceSpotlight':
      return <ServiceSpotlightGraphic {...props} />
    case 'statProof':
      return <StatProofGraphic {...props} />
    case 'packagePromo':
      return <PackagePromoGraphic {...props} />
    case 'heroQuote':
    default:
      return <HeroQuoteGraphic {...props} />
  }
}

export type { TemplateRenderProps }
