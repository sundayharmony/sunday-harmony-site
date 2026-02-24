import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: 'admin' | 'client'
      clientId?: string
    }
  }

  interface User {
    id: string
    email: string
    name: string
    role: 'admin' | 'client'
    clientId?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: string
    clientId?: string
  }
}
