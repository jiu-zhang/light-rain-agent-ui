// 在 Vue 渲染前恢复主题，防止首屏闪白（public 资源，引用路径 /theme-init.js）
;(function () {
  var themeKey = 'agent-ui-theme'
  var modeKey = 'agent-ui-theme-mode'
  try {
    var mode = localStorage.getItem(modeKey)
    var theme = void 0
    if (mode === 'light' || mode === 'dark') {
      theme = mode
    } else if (mode === 'system') {
      theme = localStorage.getItem(themeKey)
      if (!theme) {
        theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
    } else {
      theme = 'dark'
    }
    document.documentElement.setAttribute('data-theme', theme)
  } catch {
    document.documentElement.setAttribute('data-theme', 'dark')
  }
})()
