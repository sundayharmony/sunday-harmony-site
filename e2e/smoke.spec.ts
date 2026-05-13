import { test, expect } from '@playwright/test'

test('marketing home loads', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Sunday Harmony/i)
})

test('login page loads', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByText('Sign in to your dashboard')).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
})
