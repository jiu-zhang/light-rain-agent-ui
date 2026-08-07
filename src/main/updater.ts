import { net } from 'electron'
import { autoUpdater } from 'electron-updater'

const REPO = 'jiu-zhang/light-rain-agent-ui'
const OFFICIAL = `https://github.com/${REPO}/releases/latest/download/`

// 更新下载镜像列表：官方源 + 常见 GitHub 加速代理
export const MIRRORS: string[] = [
  `https://ghproxy.net/https://github.com/${REPO}/releases/latest/download/`,
  `https://gh.ddlc.top/https://github.com/${REPO}/releases/latest/download/`,
  `https://gh-proxy.com/https://github.com/${REPO}/releases/latest/download/`,
  OFFICIAL
]

const PROBE_TIMEOUT = 6000

/** 探测镜像连通性，返回响应耗时（ms）；不可达返回 null */
async function probeMirror(base: string): Promise<number | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT)
  try {
    const start = Date.now()
    const res = await net.fetch(`${base}latest.yml`, { signal: ctrl.signal })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    if (buf.byteLength < 50) return null
    return Date.now() - start
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** 并行探测所有镜像，按耗时升序返回（可达在前，不可达殿后） */
async function selectFastest(): Promise<string[]> {
  const results = await Promise.all(
    MIRRORS.map(async (m) => ({ m, latency: await probeMirror(m) }))
  )
  const ok = results
    .filter((r) => r.latency !== null)
    .sort((a, b) => (a.latency as number) - (b.latency as number))
  const fail = results.filter((r) => r.latency === null)
  return [...ok.map((r) => r.m), ...fail.map((r) => r.m)]
}

class MirrorUpdater {
  private mirrors: string[] = MIRRORS
  private index = 0

  /** 测速并应用当前最快的镜像作为更新源 */
  async init(): Promise<void> {
    this.mirrors = await selectFastest()
    this.index = 0
    this.apply()
  }

  current(): string {
    return this.mirrors[this.index]
  }

  /** 切换到下一个镜像；无可用镜像返回 null */
  next(): string | null {
    if (this.index >= this.mirrors.length - 1) return null
    this.index++
    this.apply()
    return this.current()
  }

  private apply(): void {
    autoUpdater.setFeedURL({ provider: 'generic', url: this.current() })
    console.log(`[AutoUpdater] 更新源: ${this.current()}`)
  }
}

export const mirror = new MirrorUpdater()
