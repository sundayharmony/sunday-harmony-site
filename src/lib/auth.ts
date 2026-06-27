import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { getUserByEmail, verifyPassword, seedAdmin } from './db'
import { rateLimitDurable } from './rate-limit-durable'

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

        const emailKey = credentials.email.toLowerCase().trim()
        const rl = await rateLimitDurable(`login:${emailKey}`, 10, 15 * 60 * 1000)
        if (!rl.allowed) return null

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
          clientId: user.client_id || undefined,
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
      }

      const email = typeof token.email === 'string' ? token.email : undefined
      if (email) {
        const dbUser = await getUserByEmail(email)
        if (!dbUser) {
          return { sub: token.sub }
        }
        token.role = dbUser.role
        if (dbUser.client_id) token.clientId = dbUser.client_id
        else delete token.clientId
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? ''
        if (token.role) session.user.role = token.role as string
        if (token.clientId) session.user.clientId = token.clientId as string
        else delete (session.user as { clientId?: string }).clientId
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
