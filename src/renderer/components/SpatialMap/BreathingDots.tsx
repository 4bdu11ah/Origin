import { useRef, useEffect } from 'react'
import { useSettings } from '../../contexts/SettingsContext'

const GAP = 28
const BASE_RADIUS = 1
const MAX_RADIUS = 2.4
const BREATHE_SPEED = 0.0008
const CURSOR_RADIUS = 180

export function BreathingDots() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mouseRef = useRef({ x: -1000, y: -1000 })
  const rafRef = useRef(0)
  const { settings } = useSettings()
  const isDark = settings.theme === 'dark'

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let cols = 0
    let rows = 0

    const setupSize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = container.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cols = Math.ceil(w / GAP) + 1
      rows = Math.ceil(h / GAP) + 1
    }

    setupSize()

    const ro = new ResizeObserver(setupSize)
    ro.observe(container)

    const parent = container.parentElement
    if (!parent) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 }
    }

    parent.addEventListener('mousemove', handleMouseMove)
    parent.addEventListener('mouseleave', handleMouseLeave)

    const draw = (time: number) => {
      const w = canvas.width / (window.devicePixelRatio || 1)
      const h = canvas.height / (window.devicePixelRatio || 1)
      ctx.clearRect(0, 0, w, h)

      const mx = mouseRef.current.x
      const my = mouseRef.current.y
      const cursorRadiusSq = CURSOR_RADIUS * CURSOR_RADIUS

      const baseColor = isDark ? '255, 255, 255' : '0, 0, 0'

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * GAP
          const y = row * GAP

          // Staggered breathing — each dot has a unique phase offset
          const phase = (col * 0.4 + row * 0.7) % (Math.PI * 2)
          const breathe = Math.sin(time * BREATHE_SPEED + phase)
          // Map sine [-1,1] to [0.3, 1.0] for base alpha
          const breatheAlpha = 0.3 + (breathe + 1) * 0.35
          // Map sine to subtle size variation
          const breatheSize = BASE_RADIUS + (breathe + 1) * 0.15

          // Cursor proximity boost
          const dx = x - mx
          const dy = y - my
          const distSq = dx * dx + dy * dy

          let alpha: number
          let radius: number

          if (distSq < cursorRadiusSq) {
            const t = 1 - Math.sqrt(distSq) / CURSOR_RADIUS
            const ease = t * t * (3 - 2 * t) // smoothstep
            alpha = breatheAlpha * (isDark ? 0.06 : 0.05) + ease * (isDark ? 0.32 : 0.22)
            radius = breatheSize + ease * (MAX_RADIUS - BASE_RADIUS)
          } else {
            alpha = breatheAlpha * (isDark ? 0.06 : 0.05)
            radius = breatheSize
          }

          ctx.beginPath()
          ctx.arc(x, y, radius, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${baseColor}, ${alpha})`
          ctx.fill()
        }
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      parent.removeEventListener('mousemove', handleMouseMove)
      parent.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [isDark])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0
      }}
    >
      <canvas ref={canvasRef} />
    </div>
  )
}
