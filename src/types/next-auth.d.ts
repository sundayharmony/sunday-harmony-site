import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string
      role?: string
      clientId?: string
      mfaVerified?: boolean
      mfaPending?: boolean
      mfaEnrollmentRequired?: boolean
    }
    mfaChallenge?: string
  }

  interface User {
    role?: string
    clientId?: string
    mfaVerified?: boolean
    mfaPending?: boolean
    mfaEnrollmentRequired?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string
    clientId?: string
    mfaVerified?: boolean
    mfaPending?: boolean
    mfaEnrollmentRequired?: boolean
    mfaChallenge?: string
  }
}
