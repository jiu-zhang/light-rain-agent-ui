# LightRain

LightRain - AI 智能助手桌面应用 (Electron + Vue + TypeScript)

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

## 构建与发布 (CI/CD)

本项目使用 **GitHub Actions** 在每次版本标签推送时自动构建并发布 Windows 安装包 (.exe)。

### 工作原理

1. 推送代码到 `main` 分支 → 自动执行类型检查和构建验证
2. 推送 `v*` 标签（如 `v1.0.0`）→ 自动打包成 NSIS 安装包并创建 GitHub Release

### 发布新版本

```bash
# 1. 修改 package.json 中的版本号，然后提交

# 2. 打标签并推送
git tag v1.1.0
git push origin master --tags
```

推送标签后：
1. 打开 GitHub → **Actions** 标签 → `Build and Release` 工作流会自动运行
2. 构建完成后，进入 **Releases** 标签即可下载 `.exe` 安装包

### 自动更新

应用内置 `electron-updater`，以 GitHub Releases 作为更新源。用户安装应用后，后续发布新版本时会自动静默下载并安装，无需手动操作。
