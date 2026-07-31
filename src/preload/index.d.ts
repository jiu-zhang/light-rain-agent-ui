import { ElectronAPI } from '@electron-toolkit/preload'

interface UpdateAPI {
  onUpdateAvailable: (callback: (info: { version: string; releaseDate: string }) => void) => void
  onUpdateDownloadProgress: (callback: (progress: { percent: number }) => void) => void
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => void
  startUpdateDownload: () => void
  restartAndInstall: () => void
  onBackendReady: (callback: (info: { port: number; external?: boolean }) => void) => void
  quitApp: () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: UpdateAPI
  }
}
