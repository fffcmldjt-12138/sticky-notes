# 轻量便签

Windows 10/11 桌面便签面板，使用 Electron、React、TypeScript 和 Vite。

## 功能

- 右侧贴边面板与自动隐藏
- Note 与 Todo 两种便签
- Markdown 输入和预览
- 本地 `notes.json` / `config.json`
- 待办提醒与系统通知
- 系统托盘与开机自启
- 四种头部颜色、黑白正文主题

## 开发

```powershell
npm install
npm run dev
```

生成 Windows 安装包：

```powershell
npm run dist
```

安装器固定使用 Windows 当前用户的本地应用目录。请勿把解包目录移动到
其他磁盘；部分 Windows 环境下 Electron 从非系统应用盘启动会原生崩溃。

数据保存在 Electron 的用户数据目录。渲染进程通过 preload IPC 使用主进程能力，不直接访问文件系统。
