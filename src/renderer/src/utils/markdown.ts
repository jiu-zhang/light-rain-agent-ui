/**
 * Markdown 渲染辅助函数
 */

/**
 * 补齐 content 末尾未闭合的 ``` 代码块标记，
 * 避免流式传输过程中 marked 把后续内容吞进代码块内。
 */
export function closeOpenCodeBlock(content: string): string {
  const backtickCount = (content.match(/```/g) || []).length
  if (backtickCount % 2 !== 0) {
    return content + '\n```'
  }
  return content
}
