import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { getUserByEmail, verifyPassword, seedAdmin } from './db'

// Seed admin on first load — wrapped for Vercel safety
try { seedAdmin() } catch { /* ignore on cold start */ }

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        // Re-seed admin on each login attempt (handles Vercel /tmp wipes)
        try { seedAdmin() } catch { /* ignore */ }

        const user = getUserByEmail(credentials.email)
        if (!user) return null

        const valid = verifyPassword(credentials.password, user.password)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          clientId: user.clientId,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role
        token.clientId = (user as { clientId?: string }).clientId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string }).id = token.sub as string
        ;(session.user as { role: string }).role = token.role as string
        ;(session.user as { clientId?: string }).clientId = token.clientId as string | undefined
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET || 'sunday-harmony-dev-secret-change-in-production',
}
