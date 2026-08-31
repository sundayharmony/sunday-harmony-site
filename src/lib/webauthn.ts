import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server'
import { getSupabase } from './supabase'
import { emailIlikePattern } from './email-match'
import { getPublicSiteUrl } from './smtp-mail'

export interface WebAuthnCredential {
  id: string
  user_id: string
  credential_id: string
  public_key: string
  counter: number
  device_type: string | null
  backed_up: boolean
  transports: string[] | null
  friendly_name: string | null
  created_at: string
  last_used_at: string | null
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000

export function getWebAuthnRpId(siteUrl = getPublicSiteUrl()): string {
  try {
    return new URL(siteUrl).hostname.replace(/^www\./, '')
  } catch {
    return 'localhost'
  }
}

export function getWebAuthnExpectedOrigins(siteUrl = getPublicSiteUrl()): string[] {
  try {
    const url = new URL(siteUrl)
    const origins = new Set([url.origin])
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      const port = url.port ? `:${url.port}` : ''
      origins.add(`${url.protocol}//localhost${port}`)
      origins.add(`${url.protocol}//127.0.0.1${port}`)
      return [...origins]
    }
    if (url.hostname.startsWith('www.')) {
      origins.add(`${url.protocol}//${url.hostname.slice(4)}`)
    } else {
      origins.add(`${url.protocol}//www.${url.hostname}`)
    }
    return [...origins]
  } catch {
    return ['http://localhost:3000']
  }
}

export function encodePublicKey(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url')
}

export function decodePublicKey(encoded: string): Uint8Array<ArrayBuffer> {
  const buf = Buffer.from(encoded, 'base64url')
  const copy = new Uint8Array(new ArrayBuffer(buf.byteLength))
  copy.set(buf)
  return copy
}

function asCounter(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function getRpName(): string {
  return 'Sunday Harmony'
}

export async function createRegistrationChallenge(
  userId: string,
  userEmail: string,
  userName: string
): Promise<{ options: PublicKeyCredentialCreationOptionsJSON; challengeId: string }> {
  await cleanupExpiredChallenges()
  const existingCredentials = await getUserCredentials(userId)

  const options = await generateRegistrationOptions({
    rpName: getRpName(),
    rpID: getWebAuthnRpId(),
    userName: userEmail,
    userDisplayName: userName,
    userID: new TextEncoder().encode(userId),
    attestationType: 'none',
    excludeCredentials: existingCredentials.map((cred) => ({
      id: cred.credential_id,
      transports: (cred.transports as AuthenticatorTransportFuture[]) || undefined,
    })),
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
    },
    preferredAuthenticatorType: 'localDevice',
  })

  const { data, error } = await getSupabase()
    .from('webauthn_challenges')
    .insert({
      user_id: userId,
      challenge: options.challenge,
      type: 'registration',
      expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error('Failed to store registration challenge')
  }

  return { options, challengeId: data.id }
}

export async function verifyRegistration(
  userId: string,
  response: RegistrationResponseJSON,
  friendlyName?: string
): Promise<{ verified: boolean; credential?: WebAuthnCredential }> {
  const { data: challengeRow, error: challengeError } = await getSupabase()
    .from('webauthn_challenges')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'registration')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (challengeError || !challengeRow) {
    return { verified: false }
  }

  let verification: VerifiedRegistrationResponse
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: getWebAuthnExpectedOrigins(),
      expectedRPID: getWebAuthnRpId(),
      requireUserVerification: true,
    })
  } catch {
    return { verified: false }
  }

  if (!verification.verified || !verification.registrationInfo) {
    return { verified: false }
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo

  const { data: newCred, error: insertError } = await getSupabase()
    .from('webauthn_credentials')
    .insert({
      user_id: userId,
      credential_id: credential.id,
      public_key: encodePublicKey(credential.publicKey),
      counter: credential.counter,
      device_type: credentialDeviceType,
      backed_up: credentialBackedUp,
      transports: response.response.transports || null,
      friendly_name: friendlyName?.trim() || null,
    })
    .select('*')
    .single()

  if (insertError || !newCred) {
    throw new Error('Failed to store credential')
  }

  await getSupabase().from('webauthn_challenges').delete().eq('id', challengeRow.id)
  await getSupabase().from('users').update({ passkey_enabled: true }).eq('id', userId)

  return { verified: true, credential: mapCredential(newCred) }
}

export async function createAuthenticationChallenge(
  userEmail?: string
): Promise<{
  options: PublicKeyCredentialRequestOptionsJSON
  challengeId: string
  hasCredentials: boolean
}> {
  await cleanupExpiredChallenges()

  let userId: string | null = null
  let allowCredentials: { id: string; transports?: AuthenticatorTransportFuture[] }[] | undefined
  let hasCredentials = false

  if (userEmail) {
    const { data: user } = await getSupabase()
      .from('users')
      .select('id')
      .ilike('email', emailIlikePattern(userEmail))
      .single()

    if (user) {
      userId = user.id
      const credentials = await getUserCredentials(user.id)
      hasCredentials = credentials.length > 0
      if (hasCredentials) {
        allowCredentials = credentials.map((cred) => ({
          id: cred.credential_id,
          transports: (cred.transports as AuthenticatorTransportFuture[]) || undefined,
        }))
      }
    }
  }

  const options = await generateAuthenticationOptions({
    rpID: getWebAuthnRpId(),
    allowCredentials,
    userVerification: 'required',
  })

  const { data, error } = await getSupabase()
    .from('webauthn_challenges')
    .insert({
      user_id: userId,
      challenge: options.challenge,
      type: 'authentication',
      expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error('Failed to store authentication challenge')
  }

  return { options, challengeId: data.id, hasCredentials }
}

export async function verifyAuthentication(
  response: AuthenticationResponseJSON,
  challengeId: string
): Promise<{ verified: boolean; userId?: string; credential?: WebAuthnCredential }> {
  const { data: challengeRow, error: challengeError } = await getSupabase()
    .from('webauthn_challenges')
    .select('*')
    .eq('id', challengeId)
    .eq('type', 'authentication')
    .gt('expires_at', new Date().toISOString())
    .single()

  if (challengeError || !challengeRow) {
    return { verified: false }
  }

  const { data: credentialRow, error: credError } = await getSupabase()
    .from('webauthn_credentials')
    .select('*')
    .eq('credential_id', response.id)
    .single()

  if (credError || !credentialRow) {
    return { verified: false }
  }

  if (challengeRow.user_id && challengeRow.user_id !== credentialRow.user_id) {
    return { verified: false }
  }

  let verification: VerifiedAuthenticationResponse
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: getWebAuthnExpectedOrigins(),
      expectedRPID: getWebAuthnRpId(),
      requireUserVerification: true,
      credential: {
        id: credentialRow.credential_id,
        publicKey: decodePublicKey(credentialRow.public_key),
        counter: asCounter(credentialRow.counter),
        transports: (credentialRow.transports as AuthenticatorTransportFuture[]) || undefined,
      },
    })
  } catch {
    return { verified: false }
  }

  if (!verification.verified) {
    return { verified: false }
  }

  await getSupabase()
    .from('webauthn_credentials')
    .update({
      counter: verification.authenticationInfo.newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', credentialRow.id)

  await getSupabase().from('webauthn_challenges').delete().eq('id', challengeRow.id)

  return {
    verified: true,
    userId: credentialRow.user_id,
    credential: mapCredential(credentialRow),
  }
}

export async function getUserCredentials(userId: string): Promise<WebAuthnCredential[]> {
  const { data, error } = await getSupabase()
    .from('webauthn_credentials')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error || !data) {
    return []
  }

  return data.map(mapCredential)
}

export async function deleteCredential(userId: string, credentialId: string): Promise<boolean> {
  const { error } = await getSupabase()
    .from('webauthn_credentials')
    .delete()
    .eq('id', credentialId)
    .eq('user_id', userId)

  if (error) {
    return false
  }

  const remaining = await getUserCredentials(userId)
  if (remaining.length === 0) {
    await getSupabase().from('users').update({ passkey_enabled: false }).eq('id', userId)
  }

  return true
}

export async function hasPasskeyEnabled(userId: string): Promise<boolean> {
  const credentials = await getUserCredentials(userId)
  return credentials.length > 0
}

export async function cleanupExpiredChallenges(): Promise<number> {
  const { data, error } = await getSupabase()
    .from('webauthn_challenges')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id')

  if (error) return 0
  return data?.length || 0
}

function mapCredential(row: Record<string, unknown>): WebAuthnCredential {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    credential_id: String(row.credential_id),
    public_key: String(row.public_key),
    counter: asCounter(row.counter),
    device_type: (row.device_type as string | null) ?? null,
    backed_up: Boolean(row.backed_up),
    transports: (row.transports as string[] | null) ?? null,
    friendly_name: (row.friendly_name as string | null) ?? null,
    created_at: String(row.created_at ?? ''),
    last_used_at: (row.last_used_at as string | null) ?? null,
  }
}

type PublicKeyCredentialCreationOptionsJSON = Awaited<ReturnType<typeof generateRegistrationOptions>>
type PublicKeyCredentialRequestOptionsJSON = Awaited<ReturnType<typeof generateAuthenticationOptions>>
