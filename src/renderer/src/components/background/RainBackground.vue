<template>
  <canvas ref="canvasRef" class="rain-canvas"></canvas>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let W = 0
let H = 0
let animId = 0
let time = 0

let lightTopY = 0
let lightBottomY = 0
let lightHeight = 0
let halfW = 0
let bulbX = 0
let bulbY = 0
let coneL = 0
let coneR = 0

function recalcLight(): void {
  lightHeight = H * 0.6
  halfW = W * 0.15
  lightTopY = H * 0.25
  lightBottomY = lightTopY + lightHeight
  bulbX = W / 2 + 16
  bulbY = lightTopY + 6
  coneL = bulbX - halfW
  coneR = bulbX + halfW
}

interface Drop {
  x: number
  y: number
  speed: number
  len: number
  width: number
}

interface Ripple {
  x: number
  y: number
  r: number
  maxR: number
  a: number
}

interface SplashParticle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
}

interface Dust {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  a: number
}

let drops: Drop[] = []
let ripples: Ripple[] = []
let splashes: SplashParticle[] = []
let dusts: Dust[] = []

function inCone(x: number, y: number): number {
  if (y < lightTopY || y > lightBottomY + 5) return 0
  const t = (y - lightTopY) / lightHeight
  const hw = halfW * t
  const dx = Math.abs(x - bulbX)
  if (dx > hw) return 0
  return Math.max(0, 1 - dx / hw)
}

// ==================== Background ====================

function drawBackground(): void {
  if (!ctx) return

  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.55)
  sky.addColorStop(0, '#05050a')
  sky.addColorStop(0.5, '#08081a')
  sky.addColorStop(1, '#0a0a1a')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, H * 0.55)

  const gnd = ctx.createLinearGradient(0, H * 0.55, 0, H)
  gnd.addColorStop(0, '#0a0a1a')
  gnd.addColorStop(0.3, '#0d0d20')
  gnd.addColorStop(1, '#0f0f22')
  ctx.fillStyle = gnd
  ctx.fillRect(0, H * 0.55, W, H * 0.45)

  ctx.strokeStyle = 'rgba(255,255,255,0.015)'
  ctx.lineWidth = 0.5
  for (let i = 0; i < 12; i++) {
    const y = H * 0.56 + (i / 12) * H * 0.38
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
}

// ==================== Lamp ====================

function drawLamp(): void {
  if (!ctx) return

  const px = W / 2
  const py = lightTopY + 8

  ctx.fillStyle = '#12122a'
  ctx.strokeStyle = '#1e1e3a'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.ellipse(px, lightBottomY, 5, 2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.strokeStyle = '#161632'
  ctx.lineWidth = 3.5
  ctx.beginPath()
  ctx.moveTo(px, lightBottomY - 1)
  ctx.lineTo(px, py)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(50,50,80,0.15)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(px + 1, lightBottomY - 1)
  ctx.lineTo(px + 1, py)
  ctx.stroke()

  ctx.fillStyle = '#181840'
  ctx.strokeStyle = '#222250'
  ctx.lineWidth = 0.6
  ctx.beginPath()
  ctx.arc(px, py, 2.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.strokeStyle = '#161632'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(px, py)
  ctx.quadraticCurveTo(bulbX - 5, lightTopY + 5, bulbX, lightTopY)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(50,50,80,0.12)'
  ctx.lineWidth = 0.6
  ctx.beginPath()
  ctx.moveTo(px + 0.6, py - 0.3)
  ctx.quadraticCurveTo(bulbX - 4, lightTopY + 4, bulbX + 0.3, lightTopY - 0.3)
  ctx.stroke()

  const sw = 11,
    sh = 8
  ctx.fillStyle = '#0c0c20'
  ctx.strokeStyle = '#222248'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(bulbX - sw, lightTopY)
  ctx.lineTo(bulbX - sw * 0.7, lightTopY + sh)
  ctx.lineTo(bulbX + sw * 0.7, lightTopY + sh)
  ctx.lineTo(bulbX + sw, lightTopY)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  ctx.strokeStyle = '#222250'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(bulbX - sw * 0.7, lightTopY + sh)
  ctx.lineTo(bulbX + sw * 0.7, lightTopY + sh)
  ctx.stroke()

  const g1 = ctx.createRadialGradient(bulbX, bulbY, 0, bulbX, bulbY, 40)
  g1.addColorStop(0, 'hsla(40,8%,92%,0.15)')
  g1.addColorStop(0.1, 'hsla(40,8%,80%,0.06)')
  g1.addColorStop(0.3, 'hsla(40,6%,60%,0.02)')
  g1.addColorStop(1, 'hsla(40,4%,30%,0)')
  ctx.fillStyle = g1
  ctx.beginPath()
  ctx.arc(bulbX, bulbY, 40, 0, Math.PI * 2)
  ctx.fill()

  const g2 = ctx.createRadialGradient(bulbX, bulbY, 0, bulbX, bulbY, 14)
  g2.addColorStop(0, 'hsla(40,5%,96%,0.6)')
  g2.addColorStop(0.2, 'hsla(40,5%,88%,0.2)')
  g2.addColorStop(0.5, 'hsla(40,4%,75%,0.05)')
  g2.addColorStop(1, 'hsla(40,3%,50%,0)')
  ctx.fillStyle = g2
  ctx.beginPath()
  ctx.arc(bulbX, bulbY, 14, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = 'rgba(245,242,238,0.85)'
  ctx.beginPath()
  ctx.arc(bulbX, bulbY, 2.5, 0, Math.PI * 2)
  ctx.fill()
}

// ==================== Light Cone (realistic) ====================

function drawLightCone(): void {
  if (!ctx) return

  const midY = (bulbY + lightBottomY) / 2
  const amb = ctx.createRadialGradient(bulbX, midY, 0, bulbX, midY, halfW * 1.5)
  amb.addColorStop(0, 'hsla(40,6%,85%,0.025)')
  amb.addColorStop(0.4, 'hsla(40,5%,60%,0.008)')
  amb.addColorStop(1, 'hsla(40,4%,30%,0)')
  ctx.fillStyle = amb
  ctx.beginPath()
  ctx.arc(bulbX, midY, halfW * 1.5, 0, Math.PI * 2)
  ctx.fill()

  const cg = ctx.createLinearGradient(0, bulbY, 0, lightBottomY)
  cg.addColorStop(0, 'hsla(40,6%,88%,0.08)')
  cg.addColorStop(0.15, 'hsla(40,6%,80%,0.05)')
  cg.addColorStop(0.35, 'hsla(40,5%,65%,0.025)')
  cg.addColorStop(0.6, 'hsla(40,4%,45%,0.01)')
  cg.addColorStop(1, 'hsla(40,3%,25%,0)')
  ctx.fillStyle = cg
  ctx.beginPath()
  ctx.moveTo(bulbX, bulbY)
  ctx.lineTo(coneL, lightBottomY)
  ctx.lineTo(coneR, lightBottomY)
  ctx.closePath()
  ctx.fill()

  for (let i = -4; i <= 4; i++) {
    const t = i / 4
    const f = 0.4 + 0.6 * Math.sin(time * (1.2 + Math.abs(t) * 0.5) + i * 0.8)
    ctx.strokeStyle = `hsla(40,5%,85%,${0.025 * f})`
    ctx.lineWidth = 0.3 + Math.abs(t) * 0.4
    ctx.beginPath()
    ctx.moveTo(bulbX, bulbY)
    ctx.lineTo(bulbX + t * halfW, lightBottomY)
    ctx.stroke()
  }

  const spot = ctx.createRadialGradient(bulbX, lightBottomY, 0, bulbX, lightBottomY, halfW)
  spot.addColorStop(0, 'hsla(40,6%,80%,0.12)')
  spot.addColorStop(0.12, 'hsla(40,6%,70%,0.07)')
  spot.addColorStop(0.3, 'hsla(40,5%,55%,0.03)')
  spot.addColorStop(0.55, 'hsla(40,4%,40%,0.01)')
  spot.addColorStop(1, 'hsla(40,3%,20%,0)')
  ctx.fillStyle = spot
  ctx.beginPath()
  ctx.ellipse(bulbX, lightBottomY + 4, halfW * 0.85, 22, 0, 0, Math.PI * 2)
  ctx.fill()
}

// ==================== Dust ====================

function createDust(): Dust {
  const t = Math.random()
  const y = lightTopY + t * lightHeight
  return {
    x: bulbX + (Math.random() - 0.5) * halfW * t * 1.4,
    y,
    vx: (Math.random() - 0.5) * 0.15,
    vy: -(0.05 + Math.random() * 0.12),
    size: 0.3 + Math.random() * 1.2,
    a: 0.08 + Math.random() * 0.2
  }
}

function initDust(): void {
  dusts = []
  for (let i = 0; i < 40; i++) dusts.push(createDust())
}

function drawDust(): void {
  if (!ctx) return
  for (const d of dusts) {
    const intensity = inCone(d.x, d.y)
    if (intensity <= 0) continue
    const flicker = 0.5 + 0.5 * Math.sin(time * 2 + d.x * 6 + d.y * 5)
    ctx.fillStyle = `hsla(40,5%,90%,${d.a * intensity * flicker})`
    ctx.beginPath()
    ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2)
    ctx.fill()
  }
}

function updateDust(): void {
  for (const d of dusts) {
    d.x += d.vx
    d.y += d.vy
    if (inCone(d.x, d.y) <= 0 || d.y < lightTopY || d.y > lightBottomY) {
      Object.assign(d, createDust())
    }
  }
}

// ==================== Rain ====================

function createDrop(): Drop {
  return {
    x: Math.random() * W,
    y: -(15 + Math.random() * 50),
    speed: 100 + Math.random() * 180,
    len: 6 + Math.random() * 14,
    width: 0.4 + Math.random() * 0.8
  }
}

function initRain(): void {
  drops = []
  for (let i = 0; i < 500; i++) drops.push(createDrop())
}

function drawRain(): void {
  if (!ctx) return

  for (const d of drops) {
    const fx = d.x - 0.5 * (d.y / H)
    const intensity = inCone(fx, d.y)

    if (intensity > 0) {
      const bright = 0.3 + intensity * 0.5
      ctx.strokeStyle = `hsla(40,8%,92%,${bright})`
      ctx.lineWidth = d.width * 1.1
      ctx.beginPath()
      ctx.moveTo(fx, d.y)
      ctx.lineTo(fx, d.y + d.len)
      ctx.stroke()
    } else {
      const fade = 0.12 + 0.1 * (d.y / H)
      ctx.strokeStyle = `rgba(150,175,225,${fade})`
      ctx.lineWidth = d.width
      ctx.beginPath()
      ctx.moveTo(d.x, d.y)
      ctx.lineTo(d.x, d.y + d.len)
      ctx.stroke()
    }
  }
}

function updateRain(): void {
  for (const d of drops) {
    d.y += d.speed * 0.016
    d.x += (Math.random() - 0.5) * 0.04

    if (d.y > H + 10) {
      Object.assign(d, createDrop())
    } else if (d.y > lightBottomY - 3 && d.y < lightBottomY + 3) {
      const intensity = inCone(d.x, d.y)
      if (intensity > 0.05 && Math.random() < 0.25) {
        spawnRipple(d.x, d.y, intensity)
        spawnSplash(d.x, d.y, intensity)
      }
    }
  }
}

// ==================== Ripples ====================

function spawnRipple(x: number, y: number, intensity: number): void {
  ripples.push({
    x,
    y,
    r: 1,
    maxR: 4 + Math.random() * 12,
    a: (0.3 + Math.random() * 0.2) * (0.5 + intensity * 0.5)
  })
}

function drawRipples(): void {
  if (!ctx) return
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i]
    r.r += 0.5
    r.a *= 0.95
    const intensity = inCone(r.x, r.y)

    if (intensity > 0) {
      ctx.strokeStyle = `hsla(40,6%,85%,${r.a * (0.5 + intensity * 0.3)})`
    } else {
      ctx.strokeStyle = `rgba(150,175,225,${r.a * 0.08})`
    }
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2)
    ctx.stroke()

    if (r.a < 0.005 || r.r > r.maxR) ripples.splice(i, 1)
  }
}

// ==================== Splashes ====================

function spawnSplash(x: number, y: number, intensity: number): void {
  const count = 4 + Math.floor(Math.random() * 4)
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI * 0.4 + Math.random() * Math.PI * 0.8
    const speed = 1 + Math.random() * 2.5
    splashes.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: -(1 + Math.random() * 2.5) * (0.5 + intensity * 0.5),
      life: 0,
      maxLife: 6 + Math.floor(Math.random() * 8),
      size: 0.4 + Math.random() * 0.8
    })
  }
  for (let i = 0; i < 2; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 0.2 + Math.random() * 0.5
    splashes.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: -(0.2 + Math.random() * 0.5),
      life: 0,
      maxLife: 10 + Math.floor(Math.random() * 6),
      size: 0.2 + Math.random() * 0.3
    })
  }
}

function drawSplashes(): void {
  if (!ctx) return
  for (let i = splashes.length - 1; i >= 0; i--) {
    const s = splashes[i]
    s.life++
    if (s.life > s.maxLife) {
      splashes.splice(i, 1)
      continue
    }

    const frac = s.life / s.maxLife
    const x = s.x + s.vx * frac * 3
    const y = s.y + s.vy * frac * 3 + 0.4 * frac * frac * 12
    const alpha = Math.pow(1 - frac, 0.5) * 0.4
    const intensity = inCone(s.x, s.y)

    if (intensity > 0) {
      ctx.fillStyle = `hsla(40,6%,90%,${alpha * (0.4 + intensity * 0.4)})`
    } else {
      ctx.fillStyle = `rgba(150,175,225,${alpha * 0.2})`
    }
    ctx.beginPath()
    ctx.arc(x, y, s.size, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ==================== Main Loop ====================

function animate(): void {
  if (!ctx) return
  time += 0.016
  ctx.clearRect(0, 0, W, H)
  drawBackground()
  drawLightCone()
  drawDust()
  drawLamp()
  drawRain()
  drawRipples()
  drawSplashes()
  updateRain()
  updateDust()
  animId = requestAnimationFrame(animate)
}

function resize(): void {
  const canvas = canvasRef.value
  if (!canvas) return
  W = canvas.width = window.innerWidth
  H = canvas.height = window.innerHeight
  recalcLight()
}

function init(): void {
  const canvas = canvasRef.value
  if (!canvas) return
  ctx = canvas.getContext('2d')
  resize()
  window.addEventListener('resize', resize)
  initRain()
  initDust()
  animate()
}

onMounted(() => init())
onBeforeUnmount(() => {
  cancelAnimationFrame(animId)
  window.removeEventListener('resize', resize)
})
</script>

<style scoped>
.rain-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}
</style>
