export function endedOutsidePanel(
  clientX: number,
  clientY: number,
  width: number,
  height: number
): boolean {
  return clientX <= 0 || clientY <= 0 || clientX >= width || clientY >= height
}
