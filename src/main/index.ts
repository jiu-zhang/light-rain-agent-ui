import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  dialog,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
  protocol,
  nativeTheme
} from 'electron'
import { join, extname } from 'path'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { spawn, type ChildProcess } from 'child_process'
import * as net from 'net'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { mirror, MIRRORS } from './updater'
import icon from '../../resources/icon.png?asset'
import { DEFAULT_BACKEND_PORT } from '../shared/constants'

// 本地附件协议：允许渲染进程以 lra-file://local/?path=... 展示磁盘上的原始图片
protocol.registerSchemesAsPrivileged([
  { scheme: 'lra-file', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

const LOCAL_FILE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
}

// Windows 字体渲染优化
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-software-rasterizer')
}

// ─── 单实例锁 ──────────────────────────────────────
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let appReady = false

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) {
      if (appReady) {
        mainWindow = createWindow()
        startBackend(mainWindow)
      }
      return
    }
    if (mainWindow.isMinimized()) mainWindow.restore()
    if (!mainWindow.isVisible()) mainWindow.show()
    mainWindow.focus()
  })
}

/** 创建系统托盘 */
function createTray(): void {
  // 使用 build 目录中的图标
  const trayIcon = nativeImage.createFromPath(join(__dirname, '../../resources/icon.png'))
  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }))
  tray.setToolTip('LightRain')

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: '显示窗口',
        click: () => {
          if (mainWindow) {
            mainWindow.show()
            mainWindow.focus()
          }
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          stopBackend()
          if (tray) {
            tray.destroy()
            tray = null
          }
          app.quit()
        }
      }
    ])
  )

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

// ─── 后端管理 ──────────────────────────────────────
let backendProcess: ChildProcess | null = null
let backendPort = 0

/** 检测端口是否可用 */
function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close()
      resolve(true)
    })
    server.listen(port, '127.0.0.1')
  })
}

/** 查找可用端口 */
async function findAvailablePort(start: number): Promise<number> {
  for (let port = start; port < start + 20; port++) {
    if (await checkPort(port)) return port
  }
  throw new Error('所有端口都被占用')
}

/** 获取 JRE 路径（优先用捆绑的，回退到系统 java） */
function getJavaPath(): string {
  const bundled = join(process.resourcesPath, 'runtime', 'bin', 'java.exe')
  if (existsSync(bundled)) return bundled
  return 'java'
}

/** 启动后端 JAR */
async function startBackend(win: BrowserWindow): Promise<void> {
  // 开发环境：不启动后端，由 Vite proxy 转发（ready-to-show 中已发 backend-ready）
  if (is.dev) {
    return
  }

  try {
    backendPort = await findAvailablePort(DEFAULT_BACKEND_PORT)
  } catch {
    dialog.showErrorBox('端口不可用', '无法找到可用端口，请检查系统网络配置后重试。')
    return
  }

  const javaPath = getJavaPath()
  const jarPath = join(process.resourcesPath, 'backend', 'light-rain-agent.jar')

  if (!existsSync(jarPath)) {
    win.webContents.send('backend-ready', { port: DEFAULT_BACKEND_PORT, external: true })
    return
  }

  backendProcess = spawn(javaPath, ['-jar', jarPath, `--server.port=${backendPort}`], {
    stdio: ['ignore', 'pipe', 'pipe']
  })

  backendProcess.stdout?.on('data', (data: Buffer) => {
    const output = data.toString()
    console.log('[Backend]', output.trim())
  })

  backendProcess.stderr?.on('data', (data: Buffer) => {
    console.error('[Backend-ERR]', data.toString().trim())
  })

  backendProcess.on('error', (err) => {
    console.error('[Backend] Failed to start:', err.message)
    win.webContents.send('backend-ready', { port: DEFAULT_BACKEND_PORT, external: true })
  })

  backendProcess.on('exit', (code) => {
    console.log(`[Backend] exited with code ${code}`)
    const wasStopped = backendProcess === null
    backendProcess = null
    // 主动停止（正常退出）不通知；异常退出/崩溃时告知渲染进程，触发重连提示
    if (!wasStopped && !is.dev && !win.isDestroyed()) {
      win.webContents.send('backend-down', { code })
    }
  })

  // 等待后端就绪（轮询健康检查接口）
  const maxRetries = 30
  for (let i = 0; i < maxRetries; i++) {
    await new Promise((r) => setTimeout(r, 1000))

    // 进程退出了 → 启动失败
    if (backendProcess && !backendProcess.killed && backendProcess.exitCode !== null) {
      dialog.showErrorBox('启动失败', '后端服务异常退出，请重新启动应用。')
      return
    }

    try {
      const res = await fetch(`http://127.0.0.1:${backendPort}/api/health`)
      if (res.ok) {
        win.webContents.send('backend-ready', { port: backendPort })
        return
      }
    } catch {
      // 还没就绪，继续等
    }
  }

  // 超时
  console.warn('[Backend] start timeout after 30s, notifying frontend anyway')
  win.webContents.send('backend-ready', { port: backendPort })
}

/** 停止后端 */
function stopBackend(): void {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill('SIGTERM')
    backendProcess = null
  }
}

// ─── 窗口创建 ──────────────────────────────────────
function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f0f12',
    ...(process.platform === 'win32'
      ? {
          // 隐藏原生标题栏：窗口控制按钮由 OS 作为 overlay 绘制，颜色随应用主题切换
          titleBarStyle: 'hidden' as const,
          titleBarOverlay: {
            color: '#0f0f12',
            symbolColor: '#f4f4f5',
            height: 40
          }
        }
      : {}),
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true
    }
  })

  win.on('ready-to-show', () => {
    win.show()
    createTray()
    // 开发环境：通知渲染进程隐藏启动画面，但不改 baseURL（保留 Vite proxy）
    if (is.dev) {
      win.webContents.send('backend-ready', { port: DEFAULT_BACKEND_PORT, dev: true })
    }
  })

  // 关闭时通知渲染进程弹出自定义确认弹窗
  win.on('close', (event) => {
    if (isQuitting) return
    event.preventDefault()
    win.webContents.send('confirm-close')
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

// ─── 应用生命周期 ──────────────────────────────────
let isQuitting = false

/** 主进程管理的全局快捷键：id -> accelerator */
const registeredShortcuts = new Map<string, string>()

/** 快捷键行为注册表：id -> 动作 */
const shortcutActions = new Map<string, () => void>()

/** 注册/更新全局快捷键（先注销旧的，注册失败时保留原键位并告警） */
function registerGlobalShortcut(id: string, accelerator: string, action: () => void): void {
  const old = registeredShortcuts.get(id)
  if (old) {
    globalShortcut.unregister(old)
  }
  const ok = globalShortcut.register(accelerator, action)
  if (ok) {
    registeredShortcuts.set(id, accelerator)
  } else {
    console.warn(`[Shortcut] 注册失败: ${id}=${accelerator}`)
    // 注册失败时回滚旧键位
    if (old) {
      const rollback = globalShortcut.register(old, action)
      if (rollback) registeredShortcuts.set(id, old)
    }
  }
}

/** 唤起主窗口 */
function showMainWindow(): void {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.jiuzhang.lightrain')

  // 本地附件协议处理器：按 path 参数读取磁盘文件
  protocol.handle('lra-file', async (request) => {
    const filePath = new URL(request.url).searchParams.get('path')
    if (!filePath) return new Response('missing path', { status: 400 })
    try {
      const data = await readFile(filePath)
      const mime = LOCAL_FILE_MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
      return new Response(data, { headers: { 'Content-Type': mime } })
    } catch {
      return new Response('file not found', { status: 404 })
    }
  })

  // 全局快捷键：唤起主窗口（可由设置页自定义）
  shortcutActions.set('toggleWindow', showMainWindow)
  registerGlobalShortcut('toggleWindow', 'CommandOrControl+Alt+L', showMainWindow)

  // 渲染进程上报的自定义全局快捷键
  ipcMain.on('shortcut-update', (_event, payload: { id: string; accelerator: string }) => {
    const action = shortcutActions.get(payload?.id)
    if (action && typeof payload?.accelerator === 'string' && payload.accelerator) {
      registerGlobalShortcut(payload.id, payload.accelerator, action)
    }
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  /** 退出应用（清理托盘与后端后退出） */
  function quitApp(): void {
    isQuitting = true
    stopBackend()
    if (tray) {
      tray.destroy()
      tray = null
    }
    app.quit()
  }

  // 来自 IPC：用户点击了"退出"（托盘菜单 / 关闭确认弹窗"退出"）
  ipcMain.on('quit-app', quitApp)
  // 关闭确认弹窗选择"退出应用"
  ipcMain.on('close-app', quitApp)

  ipcMain.on('hide-to-tray', () => {
    mainWindow?.hide()
  })

  // 渲染进程主题变更：同步原生标题栏颜色与系统 UI 主题
  ipcMain.on('theme-changed', (_event, payload: { mode?: string; theme?: string; bg?: string }) => {
    if (!payload || typeof payload.theme !== 'string') return
    const isDark = payload.theme === 'dark'
    nativeTheme.themeSource = payload.mode === 'system' ? 'system' : isDark ? 'dark' : 'light'
    if (process.platform === 'win32' && mainWindow?.setTitleBarOverlay) {
      mainWindow.setTitleBarOverlay({
        color: payload.bg || (isDark ? '#0f0f12' : '#ffffff'),
        symbolColor: isDark ? '#f4f4f5' : '#0f172a'
      })
    }
  })

  mainWindow = createWindow()
  appReady = true

  // 启动后端
  startBackend(mainWindow)

  // 自动更新（仅生产环境）
  if (!is.dev) {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false

    let retryCount = 0

    autoUpdater.on('error', (err) => {
      console.error('[AutoUpdater]', err.message)
      // 下载失败时切换到下一个镜像重试
      if (retryCount < MIRRORS.length && mirror.next()) {
        retryCount++
        console.log('[AutoUpdater] 切换镜像重试')
        autoUpdater.checkForUpdates()
      }
    })

    autoUpdater.on('update-available', (info) => {
      mainWindow!.webContents.send('update-available', {
        currentVersion: app.getVersion(),
        version: info.version,
        releaseDate: info.releaseDate
      })
    })

    autoUpdater.on('update-not-available', () => {
      console.log('[AutoUpdater] already up to date')
    })

    autoUpdater.on('download-progress', (progress) => {
      mainWindow!.webContents.send('update-download-progress', {
        percent: Math.round(progress.percent),
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total
      })
    })

    autoUpdater.on('update-downloaded', (info) => {
      mainWindow!.webContents.send('update-downloaded', { version: info.version })
    })

    ipcMain.on('start-update-download', () => autoUpdater.downloadUpdate())
    ipcMain.on('restart-and-install', () => autoUpdater.quitAndInstall())

    // 先测速选择最快的更新镜像，再检查更新
    setTimeout(async () => {
      await mirror.init()
      autoUpdater.checkForUpdates()
    }, 3000)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
      if (appReady) startBackend(mainWindow)
    }
  })
})

app.on('window-all-closed', () => {
  // 关闭窗口不退出，仅隐藏到托盘
})

app.on('before-quit', () => {
  globalShortcut.unregisterAll()
  stopBackend()
  isQuitting = true
})
