import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'

export function AnchoredPopover({
  anchor,
  ariaLabel,
  className,
  onClose,
  children
}: {
  anchor: HTMLElement | null
  ariaLabel: string
  className: string
  onClose(): void
  children: ReactNode
}): React.JSX.Element {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: 8, top: 8 })

  const updatePosition = useCallback(() => {
    if (!anchor || !popoverRef.current) return
    const anchorRect = anchor.getBoundingClientRect()
    const popoverRect = popoverRef.current.getBoundingClientRect()
    const margin = 8
    const gap = 7
    const left = Math.min(
      Math.max(margin, anchorRect.left),
      Math.max(margin, window.innerWidth - popoverRect.width - margin)
    )
    const below = anchorRect.bottom + gap
    const top = below + popoverRect.height <= window.innerHeight - margin
      ? below
      : Math.max(margin, anchorRect.top - popoverRect.height - gap)
    setPosition({ left, top })
  }, [anchor])

  useLayoutEffect(() => {
    updatePosition()
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node
      if (
        !popoverRef.current?.contains(target) &&
        !anchor?.contains(target)
      ) {
        onClose()
      }
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchor, onClose, updatePosition])

  return createPortal(
    <div
      ref={popoverRef}
      className={`task-settings-popover ${className}`}
      role="dialog"
      aria-label={ariaLabel}
      style={position}
    >
      {children}
    </div>,
    document.body
  )
}
