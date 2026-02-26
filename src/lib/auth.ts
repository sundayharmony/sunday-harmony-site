import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { getUserByEmail, verifyPassword, seedAdmin } from './db'
import { rateLimit } from './rate-limit'

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

        // Rate limit: 10 login attempts per 15 minutes per email
        const emailKey = credentials.email.toLowerCase().trim()
        const rl = rateLimit(`login:${emailKey}`, 10, 15 * 60 * 1000)
        if (!rl.allowed) return null

        // Ensure admin exists on each login attempt
        await seedAdmin()

        const user = await getUserByEmail(credentials.email)
        if (!user) return null

        const valid = verifyPassword(credentials.password, user.password)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          clientId: user.client_id,
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
  secret: process.env.NEXTAUTH_SECRET,
}
