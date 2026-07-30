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

## Build and Release (CI/CD)

This project uses **GitHub Actions** to automatically build and release Windows installer (.exe) on every version tag.

### How it works

1. Push code to `main` branch → runs type check and build verification
2. Push a `v*` tag (e.g. `v1.0.0`) → builds the app, packages it into an NSIS installer, and creates a GitHub Release

### Publishing a new version

```bash
# 1. Update version in package.json, then commit
git add . && git commit -m "chore: release v1.1.0"

# 2. Tag and push
git tag v1.1.0
git push origin main --tags
```

After pushing the tag:
1. Go to GitHub → **Actions** tab → `Build and Release` workflow runs automatically
2. Once complete, go to **Releases** tab to find the `.exe` installer

### Auto-update

The app uses `electron-updater` with GitHub Releases as the update source. After a user installs the app, future versions are downloaded and installed automatically when a new release is published — no manual download needed.

---

## 构建与发布 (CI/CD)

本项目使用 **GitHub Actions** 在每次版本标签推送时自动构建并发布 Windows 安装包 (.exe)。

### 工作原理

1. 推送代码到 `main` 分支 → 自动执行类型检查和构建验证
2. 推送 `v*` 标签（如 `v1.0.0`）→ 自动打包成 NSIS 安装包并创建 GitHub Release

### 发布新版本

```bash
# 1. 修改 package.json 中的版本号，然后提交
git add . && git commit -m "chore: release v1.1.0"

# 2. 打标签并推送
git tag v1.1.0
git push origin main --tags
```

推送标签后：
1. 打开 GitHub → **Actions** 标签 → `Build and Release` 工作流会自动运行
2. 构建完成后，进入 **Releases** 标签即可下载 `.exe` 安装包

### 自动更新

应用内置 `electron-updater`，以 GitHub Releases 作为更新源。用户安装应用后，后续发布新版本时会自动静默下载并安装，无需手动操作。
