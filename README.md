# 轻量便签

Windows 10/11 桌面便签面板，使用 Electron、React、TypeScript 和 Vite。

## 功能

- 右侧贴边面板与自动隐藏
- Note 与 Todo 两种便签
- 所见即所得 Markdown 编辑、格式工具栏与常驻语法提示
- 本地 `notes.json` / `config.json`
- 一个待办便签包含多条任务，每条任务可独立完成和提醒
- 系统托盘与开机自启
- 12 种预设头部颜色、自由取色与黑白正文主题
- 右键编辑、重命名、换色、切换主题、删除和分离
- 便签可拖出为常驻可编辑小窗，并在重启后恢复

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
