export type UndoActionResult = 'ok' | 'conflict'

export interface UndoCommand {
  label: string
  execute(): Promise<UndoActionResult>
}

export type UndoResult =
  | { status: 'empty' }
  | { status: UndoActionResult; label: string }

export class UndoService {
  private readonly commands: UndoCommand[] = []

  constructor(private readonly limit = 20) {}

  get size(): number {
    return this.commands.length
  }

  push(command: UndoCommand): void {
    this.commands.push(command)
    if (this.commands.length > this.limit) this.commands.shift()
  }

  latest(): { label: string } | null {
    const command = this.commands.at(-1)
    return command ? { label: command.label } : null
  }

  async undo(): Promise<UndoResult> {
    const command = this.commands.pop()
    if (!command) return { status: 'empty' }
    const status = await command.execute()
    if (status === 'conflict') this.clear()
    return { status, label: command.label }
  }

  clear(): void {
    this.commands.length = 0
  }
}
