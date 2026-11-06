const EMAIL_PATTERN = '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}'
const EMAIL_IN_TEXT = new RegExp(EMAIL_PATTERN)

function emailGlobal() {
  return new RegExp(EMAIL_PATTERN, 'g')
}

const INTERNAL_JARGON =
  /\b(gbp|seo|nap|h1|cta|pixel|meta pixel|ga only|microsite|essentials website|launch package|launch redesign|score \d|godaddy parking|wix subdomain|booksy|thecut|square\.site|business\.site|fsn network|wire-service|gohighlevel|skytab|s4shops|bootstrapmade|github pages|doteasy|local seo|keyword-stuffed|html title|schema leftovers|maps scrape|grounded.?facts|marketing_opportunity|internal send|unclaimed gbp)\b|\bvs\b/i

export type ObservationContext = {
  location?: string | null
  business?: string | null
}

export function hasProspectEmail(text?: string | null): boolean {
  return EMAIL_IN_TEXT.test(text || '')
}

export function stripProspectEmails(text: string): string {
  return text.replace(emailGlobal(), '').replace(/\s+/g, ' ').trim()
}

export function prospectCopyLooksInternal(text?: string | null): boolean {
  const value = (text || '').trim()
  if (!value) return false
  return INTERNAL_JARGON.test(value)
}

export function htmlHasLeakedProspectEmail(html?: string | null): boolean {
  const matches = (html || '').match(emailGlobal()) || []
  return matches.some((email) => !email.toLowerCase().endsWith('@sundayharmony.com'))
}

function townFromLocation(location?: string | null): string | null {
  const town = (location || '').split(',')[0]?.trim()
  if (!town || town.length < 2) return null
  return town
}

function addUnique(sentences: string[], sentence: string) {
  if (sentence && !sentences.includes(sentence)) sentences.push(sentence)
}

export function toProspectObservation(
  raw?: string | null,
  context?: ObservationContext
): string | null {
  const source = stripProspectEmails(raw || '')
  if (!source) return null
  const t = source.toLowerCase()
  const town = townFromLocation(context?.location)
  const sentences: string[] = []

  if (
    /404|parking lander|\/lander|phishing|hosting-suspended|suspendedpage|squarespace expired|blocked for visitors|\b403\b|is dead|dead 404/.test(
      t
    )
  ) {
    addUnique(sentences, 'The website people click is broken, so they never see the shop.')
  }
  if (
    /no (real |owned |official |millville-owned )?website|no official website|facebook-only|list facebook as the website|website as facebook|facebook \+ directories only|facebook \+ email only|no owned domain|no millville-owned website/.test(
      t
    )
  ) {
    addUnique(
      sentences,
      'There is no real website, so customers only find you if they already know your Facebook or a directory listing.'
    )
  }
  if (
    /free wix|wix co-branding|wix subdomain|empty square|empty html title|coming soon|unfinished|thin (simple |wix |squarespace )?site|thin squarespace|bare square|thin brochure|godaddy website builder|godaddy site|stock godaddy|wix site|keyword-stuffed wix|bootstrapmade|github pages|table-html|my site|shop co\.|linktree/.test(
      t
    )
  ) {
    addUnique(sentences, 'The website looks unfinished, which can make the shop harder to trust.')
  }
  if (
    /hours differ|homepage vs contact hours|contradictory.{0,40}hours|closing times|three closing|split hours|contact hours|hours \(/.test(
      t
    )
  ) {
    addUnique(
      sentences,
      "Your hours don't match across the internet, so people may show up when you're closed."
    )
  }
  if (/old .{0,40}address|still advertises the old|park ave address/.test(t)) {
    addUnique(sentences, 'The website still shows an old address, which can send people to the wrong place.')
  }
  if (
    /still named|name inconsistency|rebranded from|brand\/domain mismatch|doesn't match brand|email domain/.test(t)
  ) {
    addUnique(
      sentences,
      "The shop name doesn't match from one website to another, which can confuse people."
    )
  }
  if (
    /no google business profile|google business profile found|unclaimed gbp|claim this business|invisible in local|no gbp found/.test(
      t
    )
  ) {
    addUnique(sentences, 'People searching Google Maps nearby may not find you.')
  }
  if (town && (new RegExp(`no ${town}`, 'i').test(source) || /no .{0,20}landing page|title mention/.test(t))) {
    addUnique(
      sentences,
      `The website doesn't clearly say you are in ${town}, so local searchers may skip you.`
    )
  } else if (/homepage title targets|no [a-z]+ landing page/.test(t)) {
    addUnique(sentences, 'The website talks about the wrong town, so local searchers may skip you.')
  }
  if (/title\/h1|searches miss|septic only/.test(t)) {
    addUnique(
      sentences,
      'The website does not mention all of your services, so some customers may never find you.'
    )
  }
  if (
    /personal (aol|email|hotmail)|isp email|comcast|aol email|hotmail contact|att email|gmail contact|gmail address|legacy gmail|three different gmail|personal hotmail/.test(
      t
    )
  ) {
    addUnique(
      sentences,
      'The public contact email looks personal, which can make the shop harder to trust.'
    )
  }
  if (
    /no online ordering|no ordering|cannot order|ordering url 404|no order page|no ordering site|no online ordering link/.test(
      t
    )
  ) {
    addUnique(sentences, 'Customers cannot order online from the website.')
  }
  if (/no booking|no booksy|fragmented square booking/.test(t)) {
    addUnique(sentences, 'Customers cannot book a visit online from the website.')
  }
  if (
    /two live domains|dual domains|split the brand|brand\/domain mismatch/.test(t) &&
    !sentences.some((sentence) => sentence.includes('name doesn\'t match') || sentence.includes('more than one name'))
  ) {
    addUnique(
      sentences,
      'The shop shows up under more than one name or website, which can confuse people.'
    )
  }
  if (/typos/.test(t)) {
    addUnique(sentences, 'The website has typos, which can make the shop look less careful than it is.')
  }
  if (/buried|subpage of a personal/.test(t)) {
    addUnique(
      sentences,
      'The shop is buried inside another website, so people may never find it on their own.'
    )
  }
  if (
    /outdated|aging |dated |© 2017|footer '©|decades-old|weebly|adobe muse|established outdated/.test(t)
  ) {
    addUnique(sentences, 'The website looks old, so it may not match the shop people find in person.')
  }
  if (
    sentences.length < 2 &&
    /tiktok|instagram|facebook found|no facebook|no instagram|thecut\/facebook|social/.test(t)
  ) {
    addUnique(
      sentences,
      'People can find you on social media, but it is still hard to understand the shop online.'
    )
  }

  if (sentences.length > 0) {
    return sentences.slice(0, 2).join(' ')
  }

  const words = source.split(/\s+/).length
  if (!prospectCopyLooksInternal(source) && words >= 8 && words <= 40 && !/[;|]/.test(source)) {
    return source
  }

  return "It's harder than it should be for nearby customers to find you online and see what the shop is about."
}
