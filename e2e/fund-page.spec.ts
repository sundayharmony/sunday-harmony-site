import { expect, test } from '@playwright/test'

test.use({
  video: 'on',
})

test.describe('Fund page name', () => {
  test('shows Fund in the heading and nav on desktop and phone', async ({ page }) => {
    for (const viewport of [
      { width: 1280, height: 900, shot: 'fund-page-desktop.png', mobile: false },
      { width: 390, height: 844, shot: 'fund-page-mobile.png', mobile: true },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/build-fund')
      await expect(page).toHaveTitle(/Fund/)
      await expect(page.getByRole('heading', { name: 'Fund', level: 1 })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Build & Fund' })).toHaveCount(0)
      if (viewport.mobile) {
        await page.getByRole('button', { name: 'Open menu' }).click()
        await expect(page.locator('#mobile-nav').getByRole('link', { name: 'Fund', exact: true })).toBeVisible()
        await expect(page.locator('#mobile-nav').getByRole('link', { name: 'Build & Fund' })).toHaveCount(0)
      } else {
        await expect(page.getByRole('navigation').getByRole('link', { name: 'Fund', exact: true })).toBeVisible()
        await expect(page.getByRole('navigation').getByRole('link', { name: 'Build & Fund' })).toHaveCount(0)
      }
      await page.screenshot({ path: `/opt/cursor/artifacts/${viewport.shot}`, fullPage: true })
    }
  })
})
