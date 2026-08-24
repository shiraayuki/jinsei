import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DurationField } from './DurationField'

/** Mirrors how the sections use the field: the parent owns the value. */
function Harness({ initial = null, onChange }: { initial?: number | null; onChange?: (m: number | null) => void }) {
  const [minutes, setMinutes] = useState<number | null>(initial)
  return (
    <DurationField
      label="Time in bed"
      minutes={minutes}
      onChange={m => {
        setMinutes(m)
        onChange?.(m)
      }}
    />
  )
}

const hours = () => screen.getAllByRole('spinbutton')[0]
const mins = () => screen.getAllByRole('spinbutton')[1]

describe('DurationField', () => {
  it('takes hours and minutes typed one after the other', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await userEvent.type(hours(), '8')
    await userEvent.type(mins(), '21')

    expect(onChange).toHaveBeenLastCalledWith(501)
    expect(hours()).toHaveValue(8)
    expect(mins()).toHaveValue(21)
  })

  it('lets a filled minute field be cleared and retyped', async () => {
    render(<Harness initial={455} />)

    await userEvent.clear(mins())
    // The old field refilled itself with "0" here, so the next digits landed
    // behind it and the value could not be corrected.
    expect(mins()).toHaveValue(null)

    await userEvent.type(mins(), '40')
    expect(mins()).toHaveValue(40)
    expect(hours()).toHaveValue(7)
  })

  it('carries minutes past 59 into the hours once the field is left', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await userEvent.type(mins(), '95')
    expect(onChange).toHaveBeenLastCalledWith(95)

    await userEvent.tab()
    expect(hours()).toHaveValue(1)
    expect(mins()).toHaveValue(35)
  })

  it('reports null once both fields are empty', async () => {
    const onChange = vi.fn()
    render(<Harness initial={90} onChange={onChange} />)

    await userEvent.clear(hours())
    await userEvent.clear(mins())

    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('follows a value set from outside, as the screenshot import does', async () => {
    function Importer() {
      const [minutes, setMinutes] = useState<number | null>(null)
      return (
        <>
          <button onClick={() => setMinutes(501)}>import</button>
          <DurationField label="Time in bed" minutes={minutes} onChange={setMinutes} />
        </>
      )
    }
    render(<Importer />)

    await userEvent.click(screen.getByRole('button', { name: 'import' }))

    expect(hours()).toHaveValue(8)
    expect(mins()).toHaveValue(21)
  })
})
