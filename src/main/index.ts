import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { spawn, type ChildProcess } from 'child_process'
import * as net from 'net'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'

// Windows 字体渲染优化
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-software-rasterizer')
}

// ─── 后端管理 ──────────────────────────────────────
let backendProcess: ChildProcess | null = null
let backendPort = 0
const DEFAULT_PORT = 18080

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
  // 开发环境：不启动后端，由 Vite proxy 转发
  if (is.dev) {
    win.webContents.send('backend-ready', { port: DEFAULT_PORT })
    return
  }

  try {
    backendPort = await findAvailablePort(DEFAULT_PORT)
  } catch {
    dialog.showErrorBox('端口不可用', '无法找到可用端口，请检查系统网络配置后重试。')
    return
  }

  const javaPath = getJavaPath()
  const jarPath = join(process.resourcesPath, 'backend', 'light-rain-agent.jar')

  if (!existsSync(jarPath)) {
    win.webContents.send('backend-ready', { port: DEFAULT_PORT, external: true })
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
    win.webContents.send('backend-ready', { port: DEFAULT_PORT, external: true })
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
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// ─── 应用生命周期 ──────────────────────────────────
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.jiuzhang.lightrain')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  const mainWindow = createWindow()

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
      mainWindow.webContents.send('update-available', {
        version: info.version,
        releaseDate: info.releaseDate
      })
    })

    autoUpdater.on('update-not-available', () => {
      console.log('[AutoUpdater] already up to date')
    })

    autoUpdater.on('download-progress', (progress) => {
      mainWindow.webContents.send('update-download-progress', {
        percent: Math.round(progress.percent),
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total
      })
    })

    autoUpdater.on('update-downloaded', (info) => {
      mainWindow.webContents.send('update-downloaded', { version: info.version })
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
  stopBackend()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => stopBackend())
