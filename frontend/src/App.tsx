import { useState, useEffect } from 'react'
import './App.css'

type Todo = {
  id: string
  title: string
  done: boolean
  created_at: number
}

function App() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [title, setTitle] = useState("")
  const [loading, setLoading] = useState(true)

  async function getDevToken(): Promise<string> {
    const res = await fetch("/dev/token")
    if (!res.ok) throw new Error("failed to get token")

    const data = await res.json()
    return data.token
  }

  async function authedFetch(input: RequestInfo, init?: RequestInit) {
    const t = await getDevToken();

    return fetch(input, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json"
      }
    });
  }

  async function load() {
    setLoading(true)

    try {
      const res = await authedFetch("/todos")
      if (!res.ok) throw new Error("failed to fetch todos")

      const data = await res.json()
      setTodos(data)

    } finally {
      setLoading(false)
    }
  }

  async function onAdd() {
    if (!title.trim()) return

    const res = await authedFetch("/todos", {
      method: "POST",
      body: JSON.stringify({ title })
    })
    if (!res.ok) throw new Error("failed to create todo")

    setTitle("")

    await load()
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Todo (local)</h1>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="new todo"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={onAdd}>Add</button>
      </div>

      {loading ? (
        <p>loading...</p>
      ) : (
        <ul>
          {todos.map((t) => (
            <li key={t.id}>
              {t.title}{" "}
              <small style={{ color: "#666" }}>
                ({new Date(t.created_at * 1000).toLocaleString()})
              </small>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default App
