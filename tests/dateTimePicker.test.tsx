// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DateTimePicker } from '../src/renderer/src/components/DateTimePicker'

describe('DateTimePicker', () => {
  it('commits a date, hour, and minute only after confirmation', () => {
    const onChange = vi.fn()
    render(
      <DateTimePicker
        label="提醒时间"
        value=""
        onChange={onChange}
      />
    )

    fireEvent.change(screen.getByLabelText('提醒日期'), {
      target: { value: '2026-06-16' }
    })
    fireEvent.change(screen.getByLabelText('提醒小时'), {
      target: { value: '09' }
    })
    fireEvent.change(screen.getByLabelText('提醒分钟'), {
      target: { value: '30' }
    })

    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '确认提醒时间' }))
    expect(onChange).toHaveBeenCalledWith('2026-06-16T09:30')
  })

  it('renders scrollable hour and minute lists', () => {
    render(<DateTimePicker label="DDL 时间" value="" onChange={vi.fn()} />)

    expect(screen.getByLabelText('DDL 小时')).toHaveAttribute('size', '5')
    expect(screen.getByLabelText('DDL 分钟')).toHaveAttribute('size', '5')
  })
})
