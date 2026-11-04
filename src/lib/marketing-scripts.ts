export type OutreachScript = {
  id: 'established' | 'startup' | 'follow_up' | 'in_person'
  label: string
  channel: 'email' | 'copy'
  subject: string
  body: string
}

export type ScriptProspect = {
  business: string
  contactName: string
  senderName: string
  siteUrl?: string
}

function firstName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return 'there'
  return trimmed.split(/\s+/)[0]
}

export function outreachScripts(prospect: ScriptProspect): OutreachScript[] {
  const name = firstName(prospect.contactName)
  const business = prospect.business.trim() || 'your business'
  const sender = prospect.senderName.trim() || 'Sunday Harmony'
  const site = (prospect.siteUrl || 'https://www.sundayharmony.com').replace(/\/$/, '')
  const signoff = `Best,\n${sender}\nSunday Harmony\n${site}`

  return [
    {
      id: 'established',
      label: 'Established business',
      channel: 'email',
      subject: `Marketing opportunity for ${business}`,
      body: `Hi ${name},\n\nMy name is ${sender}, and I'm reaching out from Sunday Harmony, a marketing and creative services company.\n\nWe work with businesses to improve their branding, websites, online visibility, and overall marketing presence.\n\nI came across ${business} and noticed a few opportunities where your online presence could potentially be strengthened.\n\nI'd love to introduce our services and see whether there might be an opportunity to help your business improve its marketing.\n\nWould you be available for a brief conversation?\n\n${signoff}`,
    },
    {
      id: 'startup',
      label: 'Startup',
      channel: 'email',
      subject: 'Helping you establish your business brand',
      body: `Hi ${name},\n\nCongratulations on your business venture.\n\nI'm reaching out from Sunday Harmony. We help entrepreneurs and new businesses establish a professional brand and online presence.\n\nOur services include branding, website development, business materials, and promotional production.\n\nIf you're currently preparing to launch or grow ${business}, I'd love to discuss how we could help.\n\n${signoff}`,
    },
    {
      id: 'follow_up',
      label: 'Follow-up',
      channel: 'email',
      subject: `Following up with ${business}`,
      body: `Hi ${name}, I wanted to follow up on my previous message and see if you had a chance to review it.\n\nI'd still love the opportunity to connect and discuss whether Sunday Harmony could help with your business's branding, website, or marketing needs.\n\nIf improving your marketing presence is something you're considering, I'd be happy to discuss a few ideas.\n\nThanks,\n${sender}\nSunday Harmony`,
    },
    {
      id: 'in_person',
      label: 'In-person introduction',
      channel: 'copy',
      subject: '',
      body: `Hi, how are you? My name is ${sender}. I'm with Sunday Harmony, a marketing and creative services company.\n\nWe help businesses with websites, branding, promotional materials, and their overall marketing presence.\n\nI wanted to introduce myself and leave some information about what we do. Who would be the best person to speak with about ${business}'s marketing?`,
    },
  ]
}
