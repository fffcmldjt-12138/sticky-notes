# 轻量便签

一个面向 Windows 10/11 的轻量桌面便签工具，使用 Electron、React、TypeScript 和 Vite 开发。

## 功能

- 右侧贴边面板、自动隐藏、系统托盘和开机自启
- 笔记与待办两种便签，可拖出为常驻可编辑小窗
- 即时 Markdown 编辑、格式工具栏、链接跳转和本地图片
- 待办支持多条独立任务、普通提醒和 DDL 多选提前提醒
- 笔记、待办与文件夹自由混排和跨层拖拽
- 最多三层嵌套文件夹，支持折叠、重命名和安全删除
- 标签筛选、自由头部取色、黑白正文主题
- 七天回收站和未使用图片清理
- 本地 `notes.json` / `config.json` 保存，不使用数据库或云同步

## 开发

```powershell
npm install
npm run dev
```

检查与构建：

```powershell
npm test
npm run typecheck
npm run build
npm run smoke
```

生成 Windows 安装包：

```powershell
npm run dist
```

数据保存在 Electron 用户数据目录。渲染进程仅通过 preload IPC 使用文件、通知、托盘和系统能力，不直接访问本地文件系统。
