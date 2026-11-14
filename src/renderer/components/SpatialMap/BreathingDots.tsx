import { useRef, useEffect } from 'react'
import { useSettings } from '../../contexts/SettingsContext'

const GAP = 28
const BASE_RADIUS = 1.6
const BREATHE_SPEED = 0.0008

export function BreathingDots() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
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

    const baseColor = isDark ? '255, 255, 255' : '0, 0, 0'
    const baseAlpha = isDark ? 0.10 : 0.08

    const draw = (time: number) => {
      const w = canvas.width / (window.devicePixelRatio || 1)
      const h = canvas.height / (window.devicePixelRatio || 1)
      ctx.clearRect(0, 0, w, h)

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * GAP
          const y = row * GAP

          const phase = (col * 0.4 + row * 0.7) % (Math.PI * 2)
          const breathe = Math.sin(time * BREATHE_SPEED + phase)
          const alpha = baseAlpha + (breathe + 1) * 0.03
          const radius = BASE_RADIUS + (breathe + 1) * 0.15

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
