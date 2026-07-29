# Light-Rain-Agent-UI 前端开发规划

## 一、技术栈确认

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue 3 | 3.5.25 | UI 框架 |
| TypeScript | 5.9.3 | 类型安全 |
| Vite | 7.2.6 | 构建工具 |
| Electron | 39.2.6 | 桌面应用 |
| Axios | 待安装 | HTTP 请求 |
| Pinia | 待安装 | 状态管理 |
| Vue Router | 待安装 | 路由管理 |

## 二、目录结构规划

```
src/renderer/src/
├── api/                    # API 接口层
│   ├── index.ts           # axios 实例配置
│   ├── types.ts           # API 类型定义
│   ├── chat.ts            # 聊天相关接口
│   ├── model.ts           # 模型管理接口
│   ├── provider.ts        # 厂商管理接口
│   ├── config.ts          # 配置管理接口
│   └── session.ts         # 会话管理接口
├── types/                  # 全局类型定义
│   ├── index.ts           # 类型导出
│   ├── chat.ts            # 聊天相关类型
│   ├── model.ts           # 模型相关类型
│   └── common.ts          # 通用类型
├── utils/                  # 工具函数
│   ├── index.ts           # 工具导出
│   ├── theme.ts           # 主题管理
│   ├── format.ts          # 格式化工具
│   └── storage.ts         # 本地存储
├── stores/                 # Pinia 状态管理
│   ├── index.ts           # store 导出
│   ├── chat.ts            # 聊天状态
│   ├── model.ts           # 模型状态
│   ├── app.ts             # 应用状态（主题等）
│   └── session.ts         # 会话状态
├── views/                  # 页面视图
│   ├── ChatView.vue       # 聊天主页面
│   ├── ModelView.vue      # 模型管理页面
│   ├── ProviderView.vue   # 厂商管理页面
│   ├── ConfigView.vue     # 配置管理页面
│   └── SessionView.vue    # 会话历史页面
├── components/             # 组件
│   ├── layout/            # 布局组件
│   │   ├── AppLayout.vue  # 主布局
│   │   ├── Sidebar.vue    # 侧边栏
│   │   └── Header.vue     # 顶部栏
│   ├── chat/              # 聊天组件
│   │   ├── ChatMessage.vue    # 消息气泡
│   │   ├── ChatInput.vue      # 输入框
│   │   ├── ChatSession.vue    # 会话列表
│   │   └── ToolCallCard.vue   # 工具调用卡片
│   ├── model/             # 模型组件
│   │   ├── ModelCard.vue      # 模型卡片
│   │   └── ModelForm.vue      # 模型表单
│   └── common/            # 通用组件
│       ├── ThemeToggle.vue    # 主题切换
│       ├── LoadingSpinner.vue # 加载动画
│       └── ConfirmDialog.vue  # 确认弹窗
├── styles/                 # 样式
│   ├── variables.css      # CSS 变量（主题色）
│   ├── animations.css     # 动画定义
│   ├── global.css         # 全局样式
│   └── themes/            # 主题
│       ├── light.css      # 浅色主题
│       └── dark.css       # 深色主题
├── router/                 # 路由
│   └── index.ts           # 路由配置
├── App.vue                 # 根组件
└── main.ts                 # 入口文件
```

## 三、主题系统设计

### 3.1 CSS 变量定义

```css
:root {
  /* 浅色主题（默认） */
  --bg-primary: #ffffff;
  --bg-secondary: #f5f7fa;
  --bg-tertiary: #e8ecf1;
  --text-primary: #1a1a2e;
  --text-secondary: #4a4a6a;
  --accent-primary: #6366f1;
  --accent-secondary: #818cf8;
  --border-color: #e2e8f0;
  --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --glow: 0 0 20px rgba(99, 102, 241, 0.3);
}

[data-theme="dark"] {
  /* 深色主题 */
  --bg-primary: #0f0f23;
  --bg-secondary: #1a1a2e;
  --bg-tertiary: #252542;
  --text-primary: #e2e8f0;
  --text-secondary: #94a3b8;
  --accent-primary: #818cf8;
  --accent-secondary: #a5b4fc;
  --border-color: #334155;
  --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
  --glow: 0 0 30px rgba(129, 140, 248, 0.4);
}
```

### 3.2 主题切换逻辑

```typescript
// utils/theme.ts
export function initTheme() {
  const saved = localStorage.getItem('theme')
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved)
  } else {
    // 跟随系统主题
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)')
    document.documentElement.setAttribute('data-theme', prefersDark.matches ? 'dark' : 'light')
    prefersDark.addEventListener('change', (e) => {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light')
    })
  }
}
```

## 四、页面设计

### 4.1 聊天主页面 (ChatView)

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Logo + 主题切换 + 设置                              │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│   Sidebar    │              Chat Area                       │
│              │                                              │
│  - 会话列表  │   ┌──────────────────────────────────────┐   │
│  - 新建会话  │   │  AI 消息（带 glow 特效）              │   │
│  - 搜索      │   └──────────────────────────────────────┘   │
│              │   ┌──────────────────────────────────────┐   │
│              │   │  用户消息（右侧）                      │   │
│              │   └──────────────────────────────────────┘   │
│              │   ┌──────────────────────────────────────┐   │
│              │   │  工具调用卡片（可展开）                │   │
│              │   └──────────────────────────────────────┘   │
│              │                                              │
│              ├──────────────────────────────────────────────┤
│              │  Input: 输入框 + 发送按钮                     │
└──────────────┴──────────────────────────────────────────────┘
```

### 4.2 动画特效

| 元素 | 动画效果 |
|------|----------|
| 卡片 | 鼠标进入：scale(1.02) + shadow 增强 + border glow |
| 按钮 | 鼠标进入：background 渐变 + scale(1.05) |
| 消息气泡 | 出现时：slide-in + fade-in |
| 侧边栏 | 切换时：slide + opacity |
| 主题切换 | 全局 transition 0.3s |
| 加载状态 | 旋转动画 + 脉冲效果 |
| AI 思考 | 打字机效果 + 光标闪烁 |

## 五、实现顺序

### 阶段 1：基础架构（今天）
1. 安装依赖（axios, pinia, vue-router）
2. 创建目录结构
3. 配置 vite 反向代理
4. 创建 axios 实例和 API 层
5. 创建类型定义
6. 创建工具函数

### 阶段 2：主题与样式（明天）
1. 定义 CSS 变量
2. 实现主题切换
3. 创建动画效果
4. 全局样式

### 阶段 3：页面实现（第 3-4 天）
1. 聊天主页面
2. 模型管理页面
3. 厂商管理页面
4. 配置管理页面
5. 会话历史页面

### 阶段 4：组件完善（第 5 天）
1. 聊天组件
2. 表单组件
3. 通用组件
