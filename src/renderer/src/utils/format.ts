/**
 * 格式化工具函数
 */

/**
 * 格式化时间为相对时间
 *
 * @param value 时间戳（毫秒）或 ISO 时间字符串
 * @returns 相对时间字符串
 */
export function formatRelativeTime(value: number | string): string {
  const timestamp = typeof value === 'string' ? new Date(value).getTime() : value
  const now = Date.now()
  const diff = now - timestamp

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 30) return `${days} 天前`
  return new Date(timestamp).toLocaleDateString()
}

/**
 * 生成随机 ID
 *
 * @param length ID 长度
 * @returns 随机 ID 字符串
 */
export function generateId(length = 8): string {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length)
}

/**
 * 下载文本文件（浏览器端 Blob 方式）
 *
 * @param filename 文件名（含扩展名）
 * @param content 文本内容
 * @param mime MIME 类型
 */
export function downloadTextFile(
  filename: string,
  content: string,
  mime = 'text/plain;charset=utf-8'
): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
