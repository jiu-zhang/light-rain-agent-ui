/**
 * Markdown 渲染辅助函数
 */
import { marked } from 'marked'
import hljs from 'highlight.js/lib/common'

// marked 全局渲染器配置：模块级单次初始化（ESM 首次导入时执行一次），
// 避免组件 v-for 每轮消息挂载都重复注册 renderer
marked.setOptions({
  breaks: true,
  gfm: true
})

marked.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
      let highlighted: string
      try {
        highlighted =
          language === 'plaintext'
            ? hljs.highlightAuto(text).value
            : hljs.highlight(text, { language, ignoreIllegals: true }).value
      } catch {
        highlighted = hljs.highlightAuto(text).value
      }
      return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`
    }
  }
})

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
