'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

/**
 * Cloudflare Turnstile widget. Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset,
 * which matches the server skipping verification. With appearance "interaction-only" the
 * widget stays hidden unless Cloudflare needs the visitor to click.
 *
 * On submit, `await ref.current.getToken()`: it returns the current token or waits for
 * Cloudflare to issue one. Tokens are single use, so call `reset()` after every submit.
 */

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || ''
export const turnstileEnabled = Boolean(TURNSTILE_SITE_KEY)

export const TURNSTILE_WAIT_MESSAGE =
  'We could not confirm you are not a bot. Complete the security check above, then try again.'

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile missing')))
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('Turnstile failed to load'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

export type TurnstileHandle = {
  /** Current token, or the next one Cloudflare issues within `timeoutMs`; '' if none. */
  getToken: (timeoutMs?: number) => Promise<string>
  reset: () => void
}

type Props = {
  action: 'contact' | 'consultation' | 'credit_start' | 'credit_intake'
  className?: string
}

/** Token for a submit. '' when Turnstile is off (the server skips the check too). */
export async function turnstileTokenForSubmit(handle: TurnstileHandle | null): Promise<string | null> {
  if (!turnstileEnabled) return ''
  const token = handle ? await handle.getToken() : ''
  return token || null
}

const TurnstileWidget = forwardRef<TurnstileHandle, Props>(function TurnstileWidget({ action, className }, ref) {
  const container = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const token = useRef('')
  const waiters = useRef<Array<(value: string) => void>>([])

  const setToken = (value: string) => {
    token.current = value
    if (!value) return
    const pending = waiters.current
    waiters.current = []
    pending.forEach((resolve) => resolve(value))
  }

  useImperativeHandle(ref, () => ({
    getToken(timeoutMs = 15000) {
      if (token.current) return Promise.resolve(token.current)
      return new Promise<string>((resolve) => {
        const done = (value: string) => {
          clearTimeout(timer)
          resolve(value)
        }
        const timer = setTimeout(() => {
          waiters.current = waiters.current.filter((fn) => fn !== done)
          resolve('')
        }, timeoutMs)
        waiters.current.push(done)
      })
    },
    reset() {
      token.current = ''
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current)
    },
  }))

  useEffect(() => {
    if (!turnstileEnabled || !container.current) return
    let cancelled = false
    loadTurnstile()
      .then((api) => {
        if (cancelled || !container.current) return
        widgetId.current = api.render(container.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action,
          appearance: 'interaction-only',
          // Flexible needs 300px; narrow phone cards get the compact 150px widget instead.
          size: container.current.offsetWidth >= 300 ? 'flexible' : 'compact',
          theme: 'light',
          callback: (value: string) => setToken(value),
          'expired-callback': () => setToken(''),
          'error-callback': () => setToken(''),
        })
      })
      .catch((error) => console.error('[turnstile]', error))
    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current)
      widgetId.current = null
    }
  }, [action])

  if (!turnstileEnabled) return null
  return <div ref={container} className={`w-full max-w-full ${className ?? ''}`} />
})

export default TurnstileWidget
