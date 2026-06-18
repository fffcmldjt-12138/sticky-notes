import type { NoteType } from '../../../shared/models'

interface Props {
  onCreate(type: NoteType): void
  onCreateFolder(): void
  onClose(): void
  canCreateFolder?: boolean
}

export function CreateMenu({
  onCreate,
  onCreateFolder,
  onClose,
  canCreateFolder = true
}: Props): React.JSX.Element {
  return (
    <div className="popover create-menu" role="menu">
      <button onClick={() => onCreate('note')}>
        <span className="menu-icon note-icon">N</span>
        <span><strong>新建笔记</strong><small>Markdown 临时记录</small></span>
      </button>
      <button onClick={() => onCreate('todo')}>
        <span className="menu-icon todo-icon">✓</span>
        <span><strong>新建待办</strong><small>任务、完成状态与提醒</small></span>
      </button>
      {canCreateFolder && (
        <button onClick={onCreateFolder}>
          <span className="menu-icon folder-icon">F</span>
          <span><strong>新建文件夹</strong><small>整理笔记和待办</small></span>
        </button>
      )}
      <button className="text-button menu-cancel" onClick={onClose}>取消</button>
    </div>
  )
}
