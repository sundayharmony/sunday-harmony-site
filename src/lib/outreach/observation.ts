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
    addUnique(
      sentences,
      "When someone clicks the website, the page doesn't seem to load. A working site would let them see the shop right away."
    )
  }
  if (
    /no (real |owned |official |millville-owned )?website|no official website|facebook-only|list facebook as the website|website as facebook|facebook \+ directories only|facebook \+ email only|no owned domain|no millville-owned website/.test(
      t
    )
  ) {
    addUnique(
      sentences,
      'It looks like people mostly find you on Facebook. A simple website would make it easier for new customers to find you on their own.'
    )
  }
  if (
    /free wix|wix co-branding|wix subdomain|empty square|empty html title|coming soon|unfinished|thin (simple |wix |squarespace )?site|thin squarespace|bare square|thin brochure|godaddy website builder|godaddy site|stock godaddy|wix site|keyword-stuffed wix|bootstrapmade|github pages|table-html|my site|shop co\.|linktree/.test(
      t
    )
  ) {
    addUnique(
      sentences,
      "The website still looks like it's getting set up. A little polish would make it feel more like the shop people meet in person."
    )
  }
  if (
    /hours differ|homepage vs contact hours|contradictory.{0,40}hours|closing times|three closing|split hours|contact hours|hours \(/.test(
      t
    )
  ) {
    addUnique(
      sentences,
      "Your hours show up a few different ways online. Lining those up would help people arrive when you're actually open."
    )
  }
  if (/old .{0,40}address|still advertises the old|park ave address/.test(t)) {
    addUnique(
      sentences,
      'The website still has an older address on it. Updating that would keep people from going to the wrong place.'
    )
  }
  if (
    /still named|name inconsistency|rebranded from|brand\/domain mismatch|doesn't match brand|email domain/.test(t)
  ) {
    addUnique(
      sentences,
      "The shop name doesn't quite match from one listing to another. Lining those up would make you easier to recognize."
    )
  }
  if (
    /no google business profile|google business profile found|unclaimed gbp|claim this business|invisible in local|no gbp found/.test(
      t
    )
  ) {
    addUnique(
      sentences,
      'Nearby people may have a hard time finding you on Google Maps. A complete listing there would help them walk in.'
    )
  }
  if (town && (new RegExp(`no ${town}`, 'i').test(source) || /no .{0,20}landing page|title mention/.test(t))) {
    addUnique(
      sentences,
      `The website doesn't clearly say you're in ${town} yet. Adding that would help local people recognize you.`
    )
  } else if (/homepage title targets|no [a-z]+ landing page/.test(t)) {
    addUnique(
      sentences,
      'The website mentions a different town than where the shop is. Matching that up would help local people find you.'
    )
  }
  if (/title\/h1|searches miss|septic only/.test(t)) {
    addUnique(
      sentences,
      "The website doesn't mention all of your services yet. Naming them would help more of the right people find you."
    )
  }
  if (
    /personal (aol|email|hotmail)|isp email|comcast|aol email|hotmail contact|att email|gmail contact|gmail address|legacy gmail|three different gmail|personal hotmail/.test(
      t
    )
  ) {
    addUnique(
      sentences,
      'The public email still looks personal. A shop email would feel a bit more official to someone new.'
    )
  }
  if (
    /no online ordering|no ordering|cannot order|ordering url 404|no order page|no ordering site|no online ordering link/.test(
      t
    )
  ) {
    addUnique(
      sentences,
      "There isn't a way to order from the website yet. Adding that would make it easier for people to buy when they're ready."
    )
  }
  if (/no booking|no booksy|fragmented square booking/.test(t)) {
    addUnique(
      sentences,
      "There isn't a way to book a visit from the website yet. A simple booking button would make that easier."
    )
  }
  if (
    /two live domains|dual domains|split the brand|brand\/domain mismatch/.test(t) &&
    !sentences.some(
      (sentence) => sentence.includes("doesn't quite match") || sentence.includes('more than one name')
    )
  ) {
    addUnique(
      sentences,
      'The shop shows up under more than one name or website. Bringing those together would make you easier to find.'
    )
  }
  if (/typos/.test(t)) {
    addUnique(
      sentences,
      'A couple of typos on the site make it look less careful than the shop probably is. A quick pass would help.'
    )
  }
  if (/buried|subpage of a personal/.test(t)) {
    addUnique(
      sentences,
      'The shop is a bit tucked away inside another website. A page of your own would make you easier to find.'
    )
  }
  if (
    /outdated|aging |dated |© 2017|footer '©|decades-old|weebly|adobe muse|established outdated/.test(t)
  ) {
    addUnique(
      sentences,
      'The website looks a little dated next to the shop people find in person. A refresh would help it match.'
    )
  }
  if (
    sentences.length < 2 &&
    /tiktok|instagram|facebook found|no facebook|no instagram|thecut\/facebook|social/.test(t)
  ) {
    addUnique(
      sentences,
      "You're easy to find on social media. A clearer website would help those posts turn into real visits."
    )
  }

  if (sentences.length > 0) {
    return sentences.slice(0, 2).join(' ')
  }

  const words = source.split(/\s+/).length
  if (!prospectCopyLooksInternal(source) && words >= 8 && words <= 40 && !/[;|]/.test(source)) {
    return source
  }

  return "There's a small gap between how the shop is in person and how it shows up online. That's something we can make easier."
}
