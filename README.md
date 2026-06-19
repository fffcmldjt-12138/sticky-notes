# 轻量便签

一个面向 Windows 10/11 的轻量桌面便签工具，使用 Electron、React、TypeScript 和 Vite 开发。

## 下载

Windows 安装包发布在
[GitHub Releases](https://github.com/fffcmldjt-12138/sticky-notes/releases)。
安装包不提交进 Git 仓库；推送 `v*` 版本标签后，GitHub Actions 会自动测试、
构建并上传 NSIS 安装包。

## 功能

- 右侧贴边面板、自动隐藏、系统托盘和开机自启
- 笔记、待办与文件夹都可拖出为常驻小窗，并在重启后恢复位置
- 即时 Markdown 编辑、格式工具栏、链接跳转和本地图片
- 待办支持四象限优先级、一层子待办、完成划线和卡片展开收起
- 时间设置统一支持时间点/时间段、提醒多选以及每天/每周/工作日重复
- 中文输入法组合输入期间保持本地草稿，避免丢字、重复和乱序
- 笔记、待办与文件夹统一使用 dnd-kit 拖拽手柄，支持跨层、移到上一级和窗外拖出
- 拖动时插入空隙自动扩展，避免误放；普通点击不再被识别为拖拽
- 最多三层嵌套文件夹，支持文件夹内新建、右键操作、折叠、重命名和安全删除
- 笔记和待办支持置顶；未置顶待办按最高四象限优先级显示
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
