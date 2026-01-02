import { useState, useEffect } from 'react'
import './App.css'
import { authedFetch } from './lib/apiClient'

type Todo = {
  id: string
  title: string
  done: boolean
  created_at: number
}

type Props = {
  onSignOut: () => void
}

function App({ onSignOut }: Props) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [title, setTitle] = useState("")
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")

  async function load() {
    setLoading(true)

    try {
      const res = await authedFetch("/api/todos")
      if (!res.ok) throw new Error("failed to fetch todos")

      const data = await res.json()
      setTodos(data)

    } finally {
      setLoading(false)
    }
  }

  async function onAdd() {
    if (!title.trim()) return

    const res = await authedFetch("/api/todos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title })
    })
    if (!res.ok) throw new Error("failed to create todo")

    setTitle("")

    await load()
  }

  async function onToggleDone(todo: Todo) {
    await authedFetch(`/api/todos/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        created_at: todo.created_at,
        done: !todo.done,
      }),
    })

    await load()
  }

  function startEdit(todo: Todo) {
    setEditingId(todo.id)
    setEditingTitle(todo.title)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingTitle("")
  }

  async function saveEdit(todo: Todo) {
    const next = editingTitle.trim()
    if (!next) return

    await authedFetch(`/api/todos/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        created_at: todo.created_at,
        title: next,
      }),
    })

    cancelEdit()
    await load()
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Todo</h1>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderBottom: "1px solid #ccc",
          marginBottom: "20px",
        }}
      >
        <button
          onClick={onSignOut}
        >
          サインアウト
        </button>
      </header>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="new todo"
          style={{ flex: 1, padding: 8 }}
          onKeyDown={(e) => {
            if (e.key === "Enter") onAdd()
          }}
        />
        <button onClick={onAdd}>Add</button>
      </div>

      {loading ? (
        <p>loading...</p>
      ) : (
        <ul style={{ paddingLeft: 18 }}>
          {todos.map((t) => {
            const isEditing = editingId === t.id
            return (
              <li key={t.id} style={{ marginTop: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => onToggleDone(t)}
                    aria-label="done"
                  />

                  {isEditing ? (
                    <>
                      <input
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        style={{ flex: 1, padding: 6 }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(t)
                          if (e.key === "Escape") cancelEdit()
                        }}
                      />
                      <button onClick={() => saveEdit(t)}>Save</button>
                      <button onClick={cancelEdit}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <span
                        style={{
                          flex: 1,
                          textDecoration: t.done ? "line-through" : "none",
                          color: t.done ? "#666" : "inherit",
                        }}
                      >
                        {t.title}{" "}
                        <small style={{ color: "#666" }}>
                          ({new Date(t.created_at * 1000).toLocaleString()})
                        </small>
                      </span>
                      <button onClick={() => startEdit(t)}>Edit</button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default App
