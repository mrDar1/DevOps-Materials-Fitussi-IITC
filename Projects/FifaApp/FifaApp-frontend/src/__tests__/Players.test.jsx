import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import Players from '../components/Players'

const MOCK_PLAYERS = [
  { _id: '1', name: 'Lionel Messi', team: 'Inter Miami', position: 'Forward', rating: 91 },
  { _id: '2', name: 'Cristiano Ronaldo', team: 'Al-Nassr', position: 'Forward', rating: 88 },
]

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('Players component', () => {
  it('renders the player list fetched from the API', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      json: async () => MOCK_PLAYERS,
    })

    render(<Players />)

    await waitFor(() => {
      expect(screen.getByText(/Lionel Messi/)).toBeInTheDocument()
      expect(screen.getByText(/Cristiano Ronaldo/)).toBeInTheDocument()
    })
  })

  it('shows a message when no players exist', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      json: async () => [],
    })

    render(<Players />)

    await waitFor(() => {
      expect(screen.getByText(/No players yet/)).toBeInTheDocument()
    })
  })

  it('submits the add-player form and refreshes the list', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ json: async () => [] })          // initial load
      .mockResolvedValueOnce({ json: async () => ({ id: '3' }) }) // POST
      .mockResolvedValueOnce({ json: async () => [MOCK_PLAYERS[0]] }) // reload

    render(<Players />)

    await waitFor(() => expect(screen.getByText(/No players yet/)).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('Player name'), { target: { value: 'Messi' } })
    fireEvent.change(screen.getByPlaceholderText('Team'), { target: { value: 'Inter Miami' } })
    fireEvent.change(screen.getByPlaceholderText('Position'), { target: { value: 'Forward' } })
    fireEvent.change(screen.getByPlaceholderText('Rating'), { target: { value: '91' } })

    fireEvent.click(screen.getByText('Add Player'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    const postCall = fetchMock.mock.calls[1]
    expect(postCall[1].method).toBe('POST')
  })

  it('calls DELETE and refreshes when the delete button is clicked', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ json: async () => [MOCK_PLAYERS[0]] }) // initial load
      .mockResolvedValueOnce({ json: async () => ({}) })               // DELETE
      .mockResolvedValueOnce({ json: async () => [] })                 // reload

    render(<Players />)

    await waitFor(() => expect(screen.getByText(/Lionel Messi/)).toBeInTheDocument())

    fireEvent.click(screen.getByText('Delete'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    const deleteCall = fetchMock.mock.calls[1]
    expect(deleteCall[1].method).toBe('DELETE')
  })
})
