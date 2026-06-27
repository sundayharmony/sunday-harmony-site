export function validatePassword(password: string): string | null {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters'
  }
  if (password.length > 128) {
    return 'Password is too long'
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
  }
  return null
}
