import { useEffect, useMemo, useState } from 'react'

const STATUS_OPTIONS = ['Not Started', 'In Progress', 'Complete']

function statusToFraction(status, fallback) {
  // Used only when the user changes status by hand and we need a sane
  // default completion to go with it; the analyst can still edit the
  // evidence note, and completion itself is not directly editable per
  // the assignment brief.
  if (status === 'Not Started') return 0
  if (status === 'Complete') return 1
  if (typeof fallback === 'number' && fallback > 0 && fallback < 1) {
    return fallback
  }
  return 0.5
}

function pct(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return `${Math.round(value * 100)}%`
}

function statusClass(status) {
  if (status === 'Complete') return 'status status--complete'
  if (status === 'In Progress') return 'status status--progress'
  if (status === 'Not Started') return 'status status--not-started'
  return 'status status--unknown'
}

function domainStats(controls) {
  const map = new Map()
  for (const c of controls) {
    const key = c.domain || 'Unassigned'
    if (!map.has(key)) map.set(key, { count: 0, total: 0, known: 0 })
    const bucket = map.get(key)
    bucket.count += 1
    if (typeof c.completion === 'number') {
      bucket.total += c.completion
      bucket.known += 1
    }
  }
  return Array.from(map.entries())
    .map(([domain, s]) => ({
      domain,
      count: s.count,
      pct: s.known ? s.total / s.known : null,
    }))
    .sort((a, b) => a.domain.localeCompare(b.domain))
}

export default function App() {
  const [controls, setControls] = useState([])
  const [exceptions, setExceptions] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [tab, setTab] = useState('controls')
  const [query, setQuery] = useState('')
  const [expandedKey, setExpandedKey] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [ctrlRes, excRes] = await Promise.all([
          fetch('/reconciled.json'),
          fetch('/exceptions.json'),
        ])
        const ctrlData = ctrlRes.ok ? await ctrlRes.json() : []
        const excData = excRes.ok ? await excRes.json() : []
        if (cancelled) return
        setControls(
          Array.isArray(ctrlData)
            ? ctrlData.map((c, i) => ({ ...c, _key: `${c.id ?? 'row'}-${i}` }))
            : [],
        )
        setExceptions(Array.isArray(excData) ? excData : [])
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            'Could not load reconciled.json / exceptions.json. Run reconcile.py and copy the outputs into review-ui/public/.',
          )
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return controls
    return controls.filter((c) => {
      const haystack = [c.id, c.name, c.domain, c.owner, c.evidence]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [controls, query])

  const grouped = useMemo(() => {
    const map = new Map()
    for (const c of filtered) {
      const key = c.domain || 'Unassigned'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(c)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  const overall = useMemo(() => {
    const known = controls.filter((c) => typeof c.completion === 'number')
    if (!known.length) return null
    return known.reduce((sum, c) => sum + c.completion, 0) / known.length
  }, [controls])

  const stats = useMemo(() => domainStats(controls), [controls])

  function updateControl(key, patch) {
    setControls((prev) =>
      prev.map((c) => (c._key === key ? { ...c, ...patch } : c)),
    )
  }

  function handleStatusChange(control, newStatus) {
    updateControl(control._key, {
      status: newStatus,
      completion: statusToFraction(newStatus, control.completion),
    })
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__title">
          <span className="topbar__mark">ARCAIS</span>
          <h1>Control assessment review</h1>
        </div>
        <div className="topbar__overall">
          <span className="topbar__overall-label">Overall complete</span>
          <span className="topbar__overall-value">{pct(overall)}</span>
        </div>
      </header>

      <nav className="tabs">
        <button
          className={tab === 'controls' ? 'tab tab--active' : 'tab'}
          onClick={() => setTab('controls')}
        >
          Controls
        </button>
        <button
          className={tab === 'exceptions' ? 'tab tab--active' : 'tab'}
          onClick={() => setTab('exceptions')}
        >
          Exceptions
          {exceptions.length > 0 && (
            <span className="tab__badge">{exceptions.length}</span>
          )}
        </button>
      </nav>

      {loadError && <div className="banner banner--error">{loadError}</div>}

      {tab === 'controls' && (
        <div className="layout">
          <aside className="sidebar">
            <h2 className="sidebar__heading">Domains</h2>
            <ul className="sidebar__list">
              {stats.map((s) => (
                <li key={s.domain} className="sidebar__item">
                  <div className="sidebar__row">
                    <span>{s.domain}</span>
                    <span className="sidebar__count">{s.count}</span>
                  </div>
                  <div className="bar">
                    <div
                      className="bar__fill"
                      style={{ width: pct(s.pct) === '—' ? '0%' : pct(s.pct) }}
                    />
                  </div>
                  <span className="sidebar__pct">{pct(s.pct)}</span>
                </li>
              ))}
            </ul>
          </aside>

          <main className="content">
            <input
              className="search"
              type="text"
              placeholder="Search by id, name, domain, or owner…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            {grouped.length === 0 && (
              <p className="empty">No controls match “{query}”.</p>
            )}

            {grouped.map(([domain, items]) => (
              <section key={domain} className="domain-group">
                <h3 className="domain-group__heading">{domain}</h3>
                <div className="control-list">
                  {items.map((c) => {
                    const isOpen = expandedKey === c._key
                    return (
                      <div key={c._key} className="control-card">
                        <button
                          className="control-card__summary"
                          onClick={() =>
                            setExpandedKey(isOpen ? null : c._key)
                          }
                        >
                          <span className="control-card__id">
                            {c.id ?? '—'}
                          </span>
                          <span className="control-card__name">
                            {c.name || '(unnamed control)'}
                          </span>
                          <span className={statusClass(c.status)}>
                            {c.status || 'Unknown'}
                          </span>
                          <span className="control-card__completion">
                            {pct(c.completion)}
                          </span>
                        </button>

                        {isOpen && (
                          <div className="control-card__detail">
                            <div className="detail-grid">
                              <label>
                                Owner
                                <input value={c.owner || ''} readOnly />
                              </label>
                              <label>
                                Status
                                <select
                                  value={
                                    STATUS_OPTIONS.includes(c.status)
                                      ? c.status
                                      : ''
                                  }
                                  onChange={(e) =>
                                    handleStatusChange(c, e.target.value)
                                  }
                                >
                                  {!STATUS_OPTIONS.includes(c.status) && (
                                    <option value="" disabled>
                                      Unknown
                                    </option>
                                  )}
                                  {STATUS_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                Assessed
                                <input
                                  value={c.assessed_date || 'No date on file'}
                                  readOnly
                                />
                              </label>
                            </div>
                            <label className="evidence-label">
                              Evidence note
                              <textarea
                                rows={3}
                                value={c.evidence || ''}
                                placeholder="No evidence on file — add a note"
                                onChange={(e) =>
                                  updateControl(c._key, {
                                    evidence: e.target.value,
                                  })
                                }
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </main>
        </div>
      )}

      {tab === 'exceptions' && (
        <main className="content content--full">
          {exceptions.length === 0 ? (
            <p className="empty">No exceptions on file.</p>
          ) : (
            <table className="exceptions-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Control / row</th>
                  <th>Field</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {exceptions.map((e, i) => (
                  <tr key={i}>
                    <td>
                      <span className={`chip chip--${e.type || 'unknown'}`}>
                        {e.type || 'unknown'}
                      </span>
                    </td>
                    <td>
                      {e.id || e.control_id || (e.row ? `row ${e.row}` : '—')}
                    </td>
                    <td>{e.field || '—'}</td>
                    <td>{e.reason || 'No reason recorded.'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </main>
      )}
    </div>
  )
}
