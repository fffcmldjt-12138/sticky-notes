export class WindowLifecycle {
  private shuttingDown = false

  beginShutdown(): boolean {
    if (this.shuttingDown) return false
    this.shuttingDown = true
    return true
  }

  shouldHideOnClose(): boolean {
    return !this.shuttingDown
  }
}
