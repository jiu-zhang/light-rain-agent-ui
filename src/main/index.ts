import { app, shell, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage, globalShortcut } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { spawn, type ChildProcess } from 'child_process'
import * as net from 'net'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'
import { DEFAULT_BACKEND_PORT } from '../shared/constants'

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

  backendProcess = spawn(javaPath, [
    '-jar', jarPath,
    `--server.port=${backendPort}`
  ], {
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
    backendProcess = null
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
    ...(process.platform === 'linux' ? { icon } : {}),
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

  // 来自 IPC：用户点击了"退出"
  ipcMain.on('quit-app', () => {
    isQuitting = true
    stopBackend()
    if (tray) { tray.destroy(); tray = null }
    app.quit()
  })

  // 关闭确认弹窗的选择
  ipcMain.on('close-app', () => {
    isQuitting = true
    stopBackend()
    if (tray) { tray.destroy(); tray = null }
    app.quit()
  })

  ipcMain.on('hide-to-tray', () => {
    mainWindow?.hide()
  })

  mainWindow = createWindow()
  appReady = true

  // 启动后端
  startBackend(mainWindow)

  // 自动更新（仅生产环境）
  if (!is.dev) {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false

    autoUpdater.on('error', (err) => {
      console.error('[AutoUpdater]', err.message)
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

    setTimeout(() => autoUpdater.checkForUpdates(), 3000)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
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
