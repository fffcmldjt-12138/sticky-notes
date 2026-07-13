import type {
  ReminderAlertPayload,
  ReminderWindowAction
} from '../../../shared/electronApi'

export function ReminderWindow({
  payload
}: {
  payload: ReminderAlertPayload
}): React.JSX.Element {
  const respond = (action: ReminderWindowAction): void => {
    void window.stickyApi.reminder.respond(action)
  }

  return (
    <main className="strong-reminder-window" role="alertdialog" aria-modal="true">
      <header>
        <span className="strong-reminder-mark">!</span>
        <div>
          <strong>待办强提醒</strong>
          <small>{payload.body}</small>
        </div>
      </header>
      <section>
        <h1>{payload.title || '待办提醒'}</h1>
        <p>这个提醒需要你确认后才会关闭。</p>
      </section>
      <div className="strong-reminder-snooze">
        <span>稍后提醒</span>
        {[5, 10, 30].map((minutes) => (
          <button
            type="button"
            key={minutes}
            onClick={() => respond({
              type: 'snooze',
              minutes: minutes as 5 | 10 | 30
            })}
          >
            {minutes} 分钟
          </button>
        ))}
      </div>
      <footer>
        <button type="button" onClick={() => respond({ type: 'acknowledge' })}>
          知道了
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={() => respond({ type: 'open' })}
        >
          打开待办
        </button>
      </footer>
    </main>
  )
}
