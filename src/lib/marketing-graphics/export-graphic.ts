import { toPng } from 'html-to-image'

export async function exportGraphicToPng(
  element: HTMLElement,
  filename: string,
  pixelRatio: number
): Promise<void> {
  await document.fonts.ready

  const dataUrl = await toPng(element, {
    pixelRatio,
    cacheBust: true,
    skipFonts: false,
  })

  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  link.click()
}

export function buildExportFilename(
  templateId: string,
  formatId: string,
  pixelRatio: number
): string {
  const suffix = pixelRatio > 1 ? `@${pixelRatio}x` : ''
  return `sunday-harmony-${templateId}-${formatId}${suffix}.png`
}
