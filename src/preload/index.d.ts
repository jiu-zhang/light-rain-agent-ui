interface UpdateApi {
  versions: NodeJS.ProcessVersions
  onUpdateAvailable: (
    callback: (info: { currentVersion: string; version: string; releaseDate: string }) => void
  ) => () => void
  onUpdateDownloadProgress: (callback: (progress: { percent: number }) => void) => () => void
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => () => void
  startUpdateDownload: () => void
  restartAndInstall: () => void
  onBackendReady: (
    callback: (info: { port: number; external?: boolean; dev?: boolean }) => void
  ) => () => void
  onConfirmClose: (callback: () => void) => () => void
  closeApp: () => void
  hideToTray: () => void
  quitApp: () => void
  updateShortcut: (id: string, accelerator: string) => void
  getPathForFile: (file: File) => string
}

declare global {
  interface Window {
    api: UpdateApi
  }
}

export {}
