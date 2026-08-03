import { contextBridge, ipcRenderer } from 'electron'

// 自定义 IPC API：仅暴露必要通道，不暴露全量 electronAPI，缩小渲染进程攻击面
const api = {
  // 运行时版本信息（替代全量 electronAPI.process.versions）
  versions: process.versions,
  // 自动更新
  onUpdateAvailable: (
    callback: (info: { currentVersion: string; version: string; releaseDate: string }) => void
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      info: { currentVersion: string; version: string; releaseDate: string }
    ): void => callback(info)
    ipcRenderer.on('update-available', listener)
    return () => ipcRenderer.removeListener('update-available', listener)
  },
  onUpdateDownloadProgress: (callback: (progress: { percent: number }) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: { percent: number }): void =>
      callback(progress)
    ipcRenderer.on('update-download-progress', listener)
    return () => ipcRenderer.removeListener('update-download-progress', listener)
  },
  onUpdateDownloaded: (callback: (info: { version: string }) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, info: { version: string }): void =>
      callback(info)
    ipcRenderer.on('update-downloaded', listener)
    return () => ipcRenderer.removeListener('update-downloaded', listener)
  },
  startUpdateDownload: (): void => ipcRenderer.send('start-update-download'),
  restartAndInstall: (): void => ipcRenderer.send('restart-and-install'),
  // 后端
  onBackendReady: (
    callback: (info: { port: number; dev?: boolean; external?: boolean }) => void
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      info: { port: number; dev?: boolean; external?: boolean }
    ): void => callback(info)
    ipcRenderer.on('backend-ready', listener)
    return () => ipcRenderer.removeListener('backend-ready', listener)
  },
  // 关闭确认弹窗
  onConfirmClose: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('confirm-close', listener)
    return () => ipcRenderer.removeListener('confirm-close', listener)
  },
  closeApp: (): void => ipcRenderer.send('close-app'),
  hideToTray: (): void => ipcRenderer.send('hide-to-tray'),
  // 退出应用
  quitApp: (): void => ipcRenderer.send('quit-app'),
  // 快捷键：更新主进程注册的全局快捷键
  updateShortcut: (id: string, accelerator: string): void =>
    ipcRenderer.send('shortcut-update', { id, accelerator })
}

contextBridge.exposeInMainWorld('api', api)
