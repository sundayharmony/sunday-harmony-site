'use client'

import { Elements } from '@stripe/react-stripe-js'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { useMemo, type ReactNode } from 'react'

let stripePromise: Promise<Stripe | null> | null = null

function getStripePromise() {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    if (!key) {
      console.error('Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')
      return Promise.resolve(null)
    }
    stripePromise = loadStripe(key)
  }
  return stripePromise
}

export default function StripeElementsProvider({
  clientSecret,
  children,
}: {
  clientSecret: string | null
  children: ReactNode
}) {
  const stripe = useMemo(() => getStripePromise(), [])

  if (!clientSecret) {
    return <>{children}</>
  }

  return (
    <Elements
      stripe={stripe}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#c9a96e',
            borderRadius: '8px',
          },
        },
      }}
    >
      {children}
    </Elements>
  )
}
