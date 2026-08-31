import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import crypto from 'crypto'
import {
  getUserByEmail,
  upgradeUserPasswordHash,
  verifyPassword,
} from './db'
import { rateLimitDurable } from './rate-limit-durable'
import {
  consumeBackupCode,
  decryptTotpSecret,
  isStaffRole,
  verifyTotpCode,
  type MfaUserRow,
} from './mfa-totp'
import { getSupabase } from './supabase'
import { emailIlikePattern } from './email-match'
import { verifyAuthentication, hasPasskeyEnabled } from './webauthn'
import {
  applySessionVersionToToken,
  sessionVersionOf,
} from './session-version'

/** Staff JWT lifetime (seconds). Clients keep the longer default below. */
export const STAFF_SESSION_MAX_AGE = 8 * 60 * 60
const CLIENT_SESSION_MAX_AGE = 30 * 24 * 60 * 60

function challengePepper(): string {
  return process.env.NEXTAUTH_SECRET?.trim() || 'dev-mfa-challenge-pepper'
}

/** Short-lived proof that password step completed (no getToken needed in authorize). */
export function buildMfaChallenge(userId: string, window = Math.floor(Date.now() / 1000 / 300)): string {
  return crypto.createHmac('sha256', challengePepper()).update(`${userId}:${window}`).digest('hex')
}

export function verifyMfaChallenge(userId: string, challenge: string): boolean {
  if (!challenge || challenge.length < 32) return false
  const current = Math.floor(Date.now() / 1000 / 300)
  for (const w of [current, current - 1]) {
    const expected = buildMfaChallenge(userId, w)
    if (
      expected.length === challenge.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(challenge))
    ) {
      return true
    }
  }
  return false
}

async function loadMfaUser(email: string): Promise<(MfaUserRow & { client_id?: string; passkey_enabled?: boolean }) | null> {
  const { data, error } = await getSupabase()
    .from('users')
    .select('id,email,name,role,client_id,totp_enabled,totp_secret_encrypted,totp_backup_hashes,passkey_enabled')
    .ilike('email', emailIlikePattern(email))
    .single()
  if (error || !data) return null
  return data as MfaUserRow & { client_id?: string; passkey_enabled?: boolean }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const emailKey = credentials.email.toLowerCase().trim()
        const rl = await rateLimitDurable(`login:${emailKey}`, 10, 15 * 60 * 1000)
        if (!rl.allowed) return null

        const user = await getUserByEmail(credentials.email)
        if (!user) return null

        const valid = verifyPassword(credentials.password, user.password)
        if (!valid) return null

        // One-time upgrade for legacy/under-cost hashes. A failed write must not
        // reject an otherwise valid login; the next login will retry it.
        await upgradeUserPasswordHash(user.id, credentials.password, user.password)

        const staff = isStaffRole(user.role)
        if (!staff) {
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            clientId: user.client_id || undefined,
            mfaVerified: true,
            mfaPending: false,
            mfaEnrollmentRequired: false,
          }
        }

        const mfaUser = await loadMfaUser(user.email)
        const totpEnabled = Boolean(mfaUser?.totp_enabled)
        const passkeyEnabled = Boolean(mfaUser?.passkey_enabled)
        if (!totpEnabled) {
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            clientId: user.client_id || undefined,
            mfaVerified: false,
            mfaPending: false,
            mfaEnrollmentRequired: true,
            passkeyEnabled,
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          clientId: user.client_id || undefined,
          mfaVerified: false,
          mfaPending: true,
          mfaEnrollmentRequired: false,
          passkeyEnabled,
        }
      },
    }),
    CredentialsProvider({
      id: 'mfa',
      name: 'MFA',
      credentials: {
        email: { label: 'Email', type: 'email' },
        code: { label: 'Code', type: 'text' },
        challenge: { label: 'Challenge', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.code || !credentials?.challenge) return null

        const emailKey = credentials.email.toLowerCase().trim()
        const rl = await rateLimitDurable(`mfa:${emailKey}`, 5, 15 * 60 * 1000)
        if (!rl.allowed) return null

        const mfaUser = await loadMfaUser(emailKey)
        if (!mfaUser || !isStaffRole(mfaUser.role) || !mfaUser.totp_enabled) return null
        if (!verifyMfaChallenge(mfaUser.id, credentials.challenge)) return null

        const secret = mfaUser.totp_secret_encrypted
          ? decryptTotpSecret(mfaUser.totp_secret_encrypted)
          : ''
        if (!secret) return null

        const code = credentials.code.trim()
        let ok = verifyTotpCode(secret, code, mfaUser.email)

        if (!ok) {
          const consumed = consumeBackupCode(mfaUser.totp_backup_hashes, code)
          if (!consumed.ok) return null
          await getSupabase()
            .from('users')
            .update({ totp_backup_hashes: consumed.remaining })
            .eq('id', mfaUser.id)
          ok = true
        }

        if (!ok) return null

        await getSupabase()
          .from('users')
          .update({ totp_verified_at: new Date().toISOString() })
          .eq('id', mfaUser.id)

        const base = await getUserByEmail(mfaUser.email)
        if (!base) return null

        return {
          id: base.id,
          email: base.email,
          name: base.name,
          role: base.role,
          clientId: base.client_id || undefined,
          mfaVerified: true,
          mfaPending: false,
          mfaEnrollmentRequired: false,
          passkeyEnabled: Boolean(mfaUser.passkey_enabled),
        }
      },
    }),
    CredentialsProvider({
      id: 'passkey',
      name: 'Passkey',
      credentials: {
        response: { label: 'Response', type: 'text' },
        challengeId: { label: 'Challenge ID', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.response || !credentials?.challengeId) return null

        const rl = await rateLimitDurable(`passkey:${credentials.challengeId}`, 5, 15 * 60 * 1000)
        if (!rl.allowed) return null

        let response: Parameters<typeof verifyAuthentication>[0]
        try {
          response = JSON.parse(credentials.response)
        } catch {
          return null
        }

        const result = await verifyAuthentication(response, credentials.challengeId)
        if (!result.verified || !result.userId) return null

        const { data: user } = await getSupabase()
          .from('users')
          .select('id, email, name, role, client_id')
          .eq('id', result.userId)
          .single()

        if (!user || !isStaffRole(user.role)) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          clientId: user.client_id || undefined,
          mfaVerified: true,
          mfaPending: false,
          mfaEnrollmentRequired: false,
          passkeyEnabled: true,
        }
      },
    }),
    CredentialsProvider({
      id: 'passkey-mfa',
      name: 'Passkey MFA',
      credentials: {
        email: { label: 'Email', type: 'email' },
        response: { label: 'Response', type: 'text' },
        challengeId: { label: 'Challenge ID', type: 'text' },
        challenge: { label: 'MFA Challenge', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.response || !credentials?.challengeId || !credentials?.challenge) {
          return null
        }

        const emailKey = credentials.email.toLowerCase().trim()
        const rl = await rateLimitDurable(`passkey-mfa:${emailKey}`, 5, 15 * 60 * 1000)
        if (!rl.allowed) return null

        const mfaUser = await loadMfaUser(emailKey)
        if (!mfaUser || !isStaffRole(mfaUser.role)) return null
        if (!verifyMfaChallenge(mfaUser.id, credentials.challenge)) return null

        const hasPasskey = await hasPasskeyEnabled(mfaUser.id)
        if (!hasPasskey) return null

        let response: Parameters<typeof verifyAuthentication>[0]
        try {
          response = JSON.parse(credentials.response)
        } catch {
          return null
        }

        const result = await verifyAuthentication(response, credentials.challengeId)
        if (!result.verified || result.userId !== mfaUser.id) return null

        const base = await getUserByEmail(mfaUser.email)
        if (!base) return null

        return {
          id: base.id,
          email: base.email,
          name: base.name,
          role: base.role,
          clientId: base.client_id || undefined,
          mfaVerified: true,
          mfaPending: false,
          mfaEnrollmentRequired: false,
          passkeyEnabled: true,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.email = user.email
        if (user.clientId) token.clientId = user.clientId
        else delete token.clientId
        token.mfaVerified = Boolean(user.mfaVerified)
        token.mfaPending = Boolean(user.mfaPending)
        token.mfaEnrollmentRequired = Boolean(user.mfaEnrollmentRequired)
        token.passkeyEnabled = Boolean(user.passkeyEnabled)
        if (user.id || token.sub) {
          token.mfaChallenge = buildMfaChallenge(String(user.id || token.sub))
        }
      }

      const email = typeof token.email === 'string' ? token.email : undefined
      if (email) {
        const dbUser = await getUserByEmail(email)
        if (!dbUser) {
          return { sub: token.sub }
        }

        const versionCheck = applySessionVersionToToken(
          token,
          sessionVersionOf(dbUser),
          Boolean(user)
        )
        if (versionCheck.invalidated) {
          return { sub: token.sub }
        }

        token.role = dbUser.role
        if (dbUser.client_id) token.clientId = dbUser.client_id
        else delete token.clientId

        const staff = isStaffRole(dbUser.role)
        if (!staff) {
          token.mfaVerified = true
          token.mfaPending = false
          token.mfaEnrollmentRequired = false
          token.passkeyEnabled = false
          delete token.mfaChallenge
        } else {
          // Expire staff sessions after STAFF_SESSION_MAX_AGE
          const iat = typeof token.iat === 'number' ? token.iat : 0
          if (iat && Math.floor(Date.now() / 1000) - iat > STAFF_SESSION_MAX_AGE) {
            return { sub: token.sub }
          }

          if (token.mfaVerified) {
            token.mfaPending = false
            token.mfaEnrollmentRequired = false
            delete token.mfaChallenge
          } else {
            const mfaRow = await loadMfaUser(email)
            const enabled = Boolean(mfaRow?.totp_enabled)
            token.passkeyEnabled = Boolean(mfaRow?.passkey_enabled)
            if (!enabled) {
              token.mfaEnrollmentRequired = true
              token.mfaPending = false
              token.mfaVerified = false
            } else {
              token.mfaPending = true
              token.mfaEnrollmentRequired = false
              token.mfaVerified = false
            }
            if (token.sub) token.mfaChallenge = buildMfaChallenge(String(token.sub))
          }
        }
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? ''
        if (token.role) session.user.role = token.role as string
        if (token.clientId) session.user.clientId = token.clientId as string
        else delete (session.user as { clientId?: string }).clientId
        session.user.mfaVerified = Boolean(token.mfaVerified)
        session.user.mfaPending = Boolean(token.mfaPending)
        session.user.mfaEnrollmentRequired = Boolean(token.mfaEnrollmentRequired)
        session.user.passkeyEnabled = Boolean(token.passkeyEnabled)
        if (token.mfaChallenge) {
          ;(session as { mfaChallenge?: string }).mfaChallenge = token.mfaChallenge as string
        }
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: CLIENT_SESSION_MAX_AGE,
  },
  useSecureCookies: process.env.NODE_ENV === 'production',
  secret: process.env.NEXTAUTH_SECRET,
}
