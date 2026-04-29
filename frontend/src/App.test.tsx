import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from './components/ui/Button'

describe('App smoke test', () => {
  it('Button renders without crash', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })
})
