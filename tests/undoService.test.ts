import { describe, expect, it, vi } from 'vitest'
import { UndoService } from '../src/main/services/UndoService'

describe('UndoService', () => {
  it('executes the latest command once in LIFO order', async () => {
    const undo = new UndoService()
    const first = vi.fn().mockResolvedValue('ok')
    const second = vi.fn().mockResolvedValue('ok')
    undo.push({ label: '置顶', execute: first })
    undo.push({ label: '完成待办', execute: second })

    expect(undo.latest()).toEqual({ label: '完成待办' })
    await expect(undo.undo()).resolves.toEqual({
      status: 'ok', label: '完成待办'
    })
    expect(second).toHaveBeenCalledOnce()
    expect(first).not.toHaveBeenCalled()
  })

  it('keeps at most twenty entries and clears after a conflict', async () => {
    const undo = new UndoService()
    for (let index = 0; index < 21; index += 1) {
      undo.push({ label: String(index), execute: vi.fn().mockResolvedValue('ok') })
    }
    expect(undo.size).toBe(20)

    undo.push({ label: '冲突动作', execute: vi.fn().mockResolvedValue('conflict') })
    await expect(undo.undo()).resolves.toEqual({
      status: 'conflict', label: '冲突动作'
    })
    expect(undo.latest()).toBeNull()
  })
})
