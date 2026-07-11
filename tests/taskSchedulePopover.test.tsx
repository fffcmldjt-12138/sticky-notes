// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TaskSchedulePopover } from '../src/renderer/src/components/TaskSchedulePopover'

describe('TaskSchedulePopover', () => {
  it('saves a time range with multiple reminders and weekday recurrence', () => {
    const onSave = vi.fn()
    render(
      <TaskSchedulePopover
        value={null}
        anchor={document.body}
        bodyTheme="light"
        onSave={onSave}
        onClose={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '时间段' }))
    fireEvent.change(screen.getByLabelText('开始时间'), {
      target: { value: '2026-06-20T09:00' }
    })
    fireEvent.change(screen.getByLabelText('结束时间'), {
      target: { value: '2026-06-20T18:00' }
    })
    fireEvent.click(screen.getByRole('button', { name: '提前 1 天' }))
    fireEvent.click(screen.getByRole('button', { name: '提前 6 小时' }))
    fireEvent.change(screen.getByLabelText('重复'), {
      target: { value: 'weekdays' }
    })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'range',
      repeat: 'weekdays',
      reminders: [
        expect.objectContaining({ offsetMinutes: 1440 }),
        expect.objectContaining({ offsetMinutes: 360 })
      ]
    }))
  })

  it('rejects a range whose end is not after its start', () => {
    const onSave = vi.fn()
    render(
      <TaskSchedulePopover
        value={null}
        anchor={document.body}
        bodyTheme="light"
        onSave={onSave}
        onClose={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '时间段' }))
    fireEvent.change(screen.getByLabelText('开始时间'), {
      target: { value: '2026-06-20T18:00' }
    })
    fireEvent.change(screen.getByLabelText('结束时间'), {
      target: { value: '2026-06-20T09:00' }
    })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    expect(screen.getByText('结束时间必须晚于开始时间')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('adds a custom advance reminder as a selectable rule', () => {
    const onSave = vi.fn()
    render(
      <TaskSchedulePopover
        value={null}
        anchor={document.body}
        bodyTheme="light"
        onSave={onSave}
        onClose={vi.fn()}
      />
    )

    fireEvent.change(screen.getByLabelText('开始时间'), {
      target: { value: '2026-06-20T09:00' }
    })
    fireEvent.change(screen.getByLabelText('自定义提前数值'), {
      target: { value: '2' }
    })
    fireEvent.change(screen.getByLabelText('自定义提前单位'), {
      target: { value: 'days' }
    })
    fireEvent.click(screen.getByRole('button', { name: '添加提前提醒' }))
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      reminders: [expect.objectContaining({ offsetMinutes: 2880 })]
    }))
  })
})
