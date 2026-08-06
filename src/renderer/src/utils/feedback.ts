/**
 * 轻量级错误提示（toast）
 * <p>
 * 无第三方 UI 库，直接创建 DOM 节点，样式跟随主题变量。
 * </p>
 */

let container: HTMLDivElement | null = null

function ensureContainer(): HTMLDivElement {
  if (!container) {
    container = document.createElement('div')
    container.className = 'toast-container'
    document.body.appendChild(container)
  }
  return container
}

/** 展示一条错误提示，3 秒后自动消失 */
export function notifyError(message: string): void {
  const toast = document.createElement('div')
  toast.className = 'toast toast-error'
  toast.textContent = message
  ensureContainer().appendChild(toast)

  setTimeout(() => {
    toast.classList.add('toast-leave')
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}

/** 展示一条成功提示，2 秒后自动消失 */
export function notifySuccess(message: string): void {
  const toast = document.createElement('div')
  toast.className = 'toast toast-success'
  toast.textContent = message
  ensureContainer().appendChild(toast)

  setTimeout(() => {
    toast.classList.add('toast-leave')
    setTimeout(() => toast.remove(), 300)
  }, 2000)
}

/** 展示一条中性提示，2 秒后自动消失 */
export function notifyInfo(message: string): void {
  const toast = document.createElement('div')
  toast.className = 'toast toast-info'
  toast.textContent = message
  ensureContainer().appendChild(toast)

  setTimeout(() => {
    toast.classList.add('toast-leave')
    setTimeout(() => toast.remove(), 300)
  }, 2000)
}
