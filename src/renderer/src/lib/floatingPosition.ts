export function clampFloatingPosition(
  requested: { x: number; y: number },
  floating: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = 8
): { x: number; y: number } {
  return {
    x: Math.min(
      Math.max(margin, requested.x),
      Math.max(margin, viewport.width - floating.width - margin)
    ),
    y: Math.min(
      Math.max(margin, requested.y),
      Math.max(margin, viewport.height - floating.height - margin)
    )
  }
}
