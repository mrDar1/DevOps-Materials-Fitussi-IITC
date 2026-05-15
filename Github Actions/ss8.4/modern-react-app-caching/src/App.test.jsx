import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('App', () => {
  it('renders the Understanding Artifacts heading', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: /understanding artifacts/i, level: 1 })
    ).toBeInTheDocument()
  })

  it('renders the lesson section heading', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: /the lesson/i })
    ).toBeInTheDocument()
  })

  it('shows the first module open and others collapsed by default', () => {
    render(<App />)
    const first = screen.getByRole('button', { name: /what is an artifact/i })
    const second = screen.getByRole('button', { name: /uploading/i })
    expect(first).toHaveAttribute('aria-expanded', 'true')
    expect(second).toHaveAttribute('aria-expanded', 'false')
  })

  it('expands a collapsed section on click and reveals its body', async () => {
    const user = userEvent.setup()
    render(<App />)
    const upload = screen.getByRole('button', { name: /uploading/i })
    expect(screen.queryByText(/actions\/upload-artifact@v4/i)).toBeNull()
    await user.click(upload)
    expect(upload).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByText(/actions\/upload-artifact@v4/i)
    ).toBeInTheDocument()
  })

  it('collapses an open section when clicked again', async () => {
    const user = userEvent.setup()
    render(<App />)
    const first = screen.getByRole('button', { name: /what is an artifact/i })
    await user.click(first)
    expect(first).toHaveAttribute('aria-expanded', 'false')
  })

  it('does not render the removed sections-explored counter', () => {
    render(<App />)
    expect(screen.queryByText(/sections explored/i)).toBeNull()
  })

  it('renders the reference links', () => {
    render(<App />)
    expect(
      screen.getByRole('link', { name: /upload-artifact/i })
    ).toHaveAttribute('href', 'https://github.com/actions/upload-artifact')
    expect(
      screen.getByRole('link', { name: /^artifacts docs$/i })
    ).toBeInTheDocument()
  })

  it('does not render the old Vite/React template logos', () => {
    render(<App />)
    expect(screen.queryByAltText(/react logo/i)).toBeNull()
    expect(screen.queryByAltText(/vite logo/i)).toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
  })
})
