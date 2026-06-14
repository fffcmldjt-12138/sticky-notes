export interface Rectangle {
  x: number
  y: number
  width: number
  height: number
}

export function getExpandedBounds(workArea: Rectangle, panelWidth: number): Rectangle {
  return {
    x: workArea.x + workArea.width - panelWidth,
    y: workArea.y,
    width: panelWidth,
    height: workArea.height
  }
}

export function getCollapsedBounds(
  workArea: Rectangle,
  panelWidth: number,
  hotEdgeWidth: number
): Rectangle {
  return {
    x: workArea.x + workArea.width - hotEdgeWidth,
    y: workArea.y,
    width: panelWidth,
    height: workArea.height
  }
}

