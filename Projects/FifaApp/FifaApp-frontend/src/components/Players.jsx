import { useState, useEffect } from 'react'

const EMPTY_FORM = { name: '', team: '', position: '', rating: '' }

function Players() {
  const [players, setPlayers] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)

  const fetchPlayers = async () => {
    const res = await fetch('/api/players')
    const data = await res.json()
    setPlayers(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchPlayers()
  }, [])

  const addPlayer = async (e) => {
    e.preventDefault()
    await fetch('/api/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, rating: Number(form.rating) }),
    })
    setForm(EMPTY_FORM)
    fetchPlayers()
  }

  const deletePlayer = async (id) => {
    await fetch(`/api/players/${id}`, { method: 'DELETE' })
    fetchPlayers()
  }

  const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  return (
    <div>
      <form onSubmit={addPlayer} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        <input placeholder="Player name" value={form.name} onChange={handleChange('name')} required />
        <input placeholder="Team" value={form.team} onChange={handleChange('team')} required />
        <input placeholder="Position" value={form.position} onChange={handleChange('position')} required />
        <input placeholder="Rating" type="number" min="1" max="99" value={form.rating} onChange={handleChange('rating')} required />
        <button type="submit">Add Player</button>
      </form>

      {loading ? (
        <p>Loading...</p>
      ) : players.length === 0 ? (
        <p>No players yet. Add one above!</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {players.map((player) => (
            <li key={player._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
              <span>
                <strong>{player.name}</strong> — {player.team} ({player.position}) ⭐ {player.rating}
              </span>
              <button onClick={() => deletePlayer(player._id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default Players
