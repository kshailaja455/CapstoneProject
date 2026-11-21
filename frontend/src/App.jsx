import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BrainCircuit,
  CalendarDays,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock3,
  ExternalLink,
  Filter,
  GitBranch,
  Globe,
  Layers,
  LayoutDashboard,
  Minus,
  Newspaper,
  Plus,
  Radio,
  RefreshCcw,
  Search,
  Server,
  Settings,
  SlidersHorizontal,
  Sun,
  Moon,
  TrendingUp,
  Wifi,
  X,
  Zap,
} from 'lucide-react'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5050'
const DEFAULT_THRESHOLD = 0.26
const PAGE_SIZE = 12
const INGESTION_STEPS = [
  { id: 'fetch', label: 'Fetch', icon: Newspaper },
  { id: 'extract', label: 'Extract', icon: Search },
  { id: 'score', label: 'Score', icon: BrainCircuit },
  { id: 'cluster', label: 'Cluster', icon: Layers },
]
const VIEW_MODES = [
  { id: 'grouped', label: 'Grouped stories' },
  { id: 'all', label: 'All topics' },
  { id: 'single', label: 'Single articles' },
]
const VISUAL_MODES = [
  { id: 'board', label: 'Cluster board' },
  { id: 'map', label: 'Signal map' },
  { id: 'timeline', label: 'Timeline' },
]
const DATE_MODES = [
  { id: 'all', label: 'All time', hours: null },
  { id: '6h', label: '6h', hours: 6 },
  { id: '24h', label: '24h', hours: 24 },
  { id: '48h', label: '48h', hours: 48 },
]

function formatDate(value) {
  if (!value) return 'Unknown'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatAxisDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value))
}

function timeValue(value) {
  return new Date(value).getTime()
}

function clusterKind(cluster) {
  return cluster.articleCount > 1 ? 'cluster' : 'single'
}

function sourceClass(sources) {
  if (sources.length > 1) return 'mixed'
  return (sources[0] || 'unknown').toLowerCase().replace(/\s+/g, '-')
}

async function api(path, options) {
  const response = await fetch(`${API_BASE_URL}${path}`, options)
  const payload = await response.json()
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || 'Request failed')
  }
  return payload.data
}

function SegmentedControl({ label, options, value, onChange }) {
  return (
    <div className="segmented-wrap" aria-label={label}>
      {options.map((option) => (
        <button
          className={value === option.id ? 'active' : ''}
          key={option.id}
          onClick={() => onChange(option.id)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function SourceChip({ source }) {
  return <span className={`source-chip ${(source || '').toLowerCase().replace(/\s+/g, '-')}`}>{source}</span>
}

function SourceChips({ sources }) {
  return (
    <div className="source-stack">
      {sources.map((source) => <SourceChip key={source} source={source} />)}
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    clustered: 'badge-green',
    ingested: 'badge-blue',
    stored: 'badge-blue',
    discovered: 'badge-gray',
    pending: 'badge-gray',
    processing: 'badge-purple',
    processed: 'badge-teal',
    standalone: 'badge-orange',
    failed: 'badge-red',
    healthy: 'badge-green',
    degraded: 'badge-yellow',
    down: 'badge-red',
    completed: 'badge-green',
    running: 'badge-blue',
  }
  const label = status ? status.replace(/_/g, ' ') : 'unknown'
  return <span className={`status-badge ${map[status] || 'badge-gray'}`}>{label}</span>
}

function mlConfidence(cluster) {
  const sourceBoost = Math.min(cluster.sources.length * 8, 24)
  const articleBoost = Math.min(Math.max(cluster.articleCount - 1, 0) * 9, 28)
  const termBoost = Math.min((cluster.topTerms?.length || 0) * 8, 18)
  return Math.min(96, 50 + sourceBoost + articleBoost + termBoost)
}

function representativeArticle(cluster) {
  return cluster.articles?.[0]
}

function durationLabel(startTime, endTime) {
  const duration = Math.max(timeValue(endTime) - timeValue(startTime), 0)
  const hours = Math.round(duration / (60 * 60 * 1000))
  if (hours <= 0) return 'Moment'
  if (hours < 24) return `${hours}h`
  const days = Math.max(1, Math.round(hours / 24))
  return `${days}d`
}

// ─── Cluster Board ───────────────────────────────────────────────────────────
function ClusterBoard({ clusters, onOpen }) {
  if (!clusters.length) {
    return <div className="empty-state"><Search size={30} /><p>No matching topics for the selected filters.</p></div>
  }
  const featured = clusters[0]
  const rest = clusters.slice(1)
  return (
    <div className="cluster-board">
      {featured && (
        <button className={`lead-cluster ${sourceClass(featured.sources)}`} onClick={() => onOpen(featured)} type="button">
          <div className="lead-cluster-copy">
            <p className="eyebrow"><Radio size={13} /> Lead clustered story</p>
            <h3>{featured.label}</h3>
            <p>{representativeArticle(featured)?.summary || representativeArticle(featured)?.body?.slice(0, 220) || 'A live topic assembled from related reporting across the feed.'}</p>
            <div className="lead-facts">
              <span><Newspaper size={14} /> {featured.articleCount} articles</span>
              <span><GitBranch size={14} /> {featured.sources.length} sources</span>
              <span><Clock3 size={14} /> {durationLabel(featured.startTime, featured.endTime)}</span>
            </div>
          </div>
          <div className="lead-cluster-model">
            <BrainCircuit size={22} />
            <strong>{mlConfidence(featured)}%</strong>
            <span>match strength</span>
            <SourceChips sources={featured.sources} />
          </div>
        </button>
      )}
      <div className="cluster-card-grid">
        {rest.map((cluster) => (
          <button className={`cluster-card ${sourceClass(cluster.sources)} ${clusterKind(cluster)}`} key={cluster.id} onClick={() => onOpen(cluster)} type="button">
            <div className="cluster-card-top">
              <span className="cluster-kind">{cluster.articleCount > 1 ? 'Cluster' : 'Single article'}</span>
              <span className="cluster-score"><BrainCircuit size={13} /> {mlConfidence(cluster)}%</span>
            </div>
            <h3>{cluster.label}</h3>
            <p>{representativeArticle(cluster)?.summary || representativeArticle(cluster)?.body?.slice(0, 150) || 'No summary available.'}</p>
            {cluster.topTerms?.length > 0 && (
              <div className="term-row compact-terms">
                {cluster.topTerms.slice(0, 3).map((term) => <span key={term}>{term}</span>)}
              </div>
            )}
            <div className="cluster-card-footer">
              <SourceChips sources={cluster.sources} />
              <span>{formatDate(cluster.endTime)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Signal Map ───────────────────────────────────────────────────────────────
function SignalMap({ clusters, onOpen }) {
  if (!clusters.length) {
    return <div className="empty-state"><Search size={30} /><p>No matching topics for the selected filters.</p></div>
  }
  return (
    <div className="signal-map">
      {clusters.map((cluster, index) => {
        const size = Math.min(146, 82 + Math.max(cluster.articleCount - 1, 0) * 14)
        return (
          <button
            className={`signal-node-card ${sourceClass(cluster.sources)} ${clusterKind(cluster)}`}
            key={cluster.id}
            onClick={() => onOpen(cluster)}
            style={{ '--signal-size': `${size}px`, '--signal-delay': `${(index % 10) * 38}ms` }}
            type="button"
          >
            <span className="signal-bubble">
              <span className="signal-count">{cluster.articleCount}</span>
              <span className="signal-confidence">{mlConfidence(cluster)}%</span>
              {cluster.sources.slice(0, 4).map((source, si) => (
                <span className={`signal-source-dot dot-${si} ${source.toLowerCase().replace(/\s+/g, '-')}`} key={source} title={source} />
              ))}
            </span>
            <span className="signal-node-title">{cluster.label}</span>
            <span className="signal-node-meta">{cluster.sources.length} source{cluster.sources.length === 1 ? '' : 's'} · {durationLabel(cluster.startTime, cluster.endTime)}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Timeline ─────────────────────────────────────────────────────────────────
function Timeline({ clusters, onOpen }) {
  const bounds = useMemo(() => {
    if (!clusters.length) return null
    const starts = clusters.map((c) => timeValue(c.startTime))
    const ends = clusters.map((c) => timeValue(c.endTime))
    const min = Math.min(...starts)
    const max = Math.max(...ends)
    const padding = Math.max((max - min) * 0.04, 60 * 60 * 1000)
    return { min: min - padding, max: max + padding }
  }, [clusters])

  if (!bounds) return <div className="empty-state"><Search size={30} /><p>No matching topics for the selected filters.</p></div>

  const range = Math.max(bounds.max - bounds.min, 1)
  const ticks = Array.from({ length: 5 }).map((_, i) => bounds.min + (range / 4) * i)
  const chartClusters = clusters.slice(0, 48)
  const laneHeight = 76
  const chartHeight = Math.max(420, chartClusters.length * laneHeight + 96)

  return (
    <div className="timeline-shell">
      <div className="timeline-summary">
        <div>
          <p className="eyebrow">Activity windows</p>
          <h3>{chartClusters.length} topics plotted on one time axis</h3>
        </div>
        <span>{formatDate(bounds.min)} – {formatDate(bounds.max)}</span>
      </div>
      <div className="timeline-chart" style={{ '--timeline-height': `${chartHeight}px` }}>
        <div className="timeline-label-column" aria-hidden="true">
          <div className="timeline-label-spacer" />
          {chartClusters.map((cluster) => (
            <div className="timeline-row-label" key={cluster.id}>
              <strong>{cluster.label}</strong>
              <span>{cluster.articleCount} article{cluster.articleCount === 1 ? '' : 's'} · {durationLabel(cluster.startTime, cluster.endTime)} · {cluster.sources.join(', ')}</span>
            </div>
          ))}
        </div>
        <div className="timeline-plot">
          <div className="timeline-ruler">
            {ticks.map((tick) => (
              <span className="timeline-tick-label" key={tick} style={{ left: `${((tick - bounds.min) / range) * 100}%` }}>
                {formatAxisDate(tick)}
              </span>
            ))}
          </div>
          <div className="timeline-grid" aria-hidden="true">
            {ticks.map((tick) => (
              <span className="timeline-grid-line" key={tick} style={{ left: `${((tick - bounds.min) / range) * 100}%` }} />
            ))}
          </div>
          {chartClusters.map((cluster, index) => {
            const start = ((timeValue(cluster.startTime) - bounds.min) / range) * 100
            const span = ((timeValue(cluster.endTime) - timeValue(cluster.startTime)) / range) * 100
            const isSingle = clusterKind(cluster) === 'single'
            const width = isSingle ? 0 : Math.max(span, 2.8)
            const top = 60 + index * laneHeight
            return (
              <button
                className={`timeline-marker ${isSingle ? 'single' : 'grouped'} ${sourceClass(cluster.sources)}`}
                key={cluster.id}
                onClick={() => onOpen(cluster)}
                style={{
                  '--timeline-left': `${Math.min(Math.max(start, 0.5), 98)}%`,
                  '--timeline-width': `${Math.min(width, 100 - start)}%`,
                  '--timeline-top': `${top}px`,
                  '--timeline-opacity': cluster.intensity || 0.65,
                }}
                title={`${cluster.label} · ${formatDate(cluster.startTime)} - ${formatDate(cluster.endTime)}`}
                type="button"
              >
                <span className="timeline-shape" />
                <span className="timeline-marker-count">{cluster.articleCount}</span>
              </button>
            )
          })}
        </div>
      </div>
      {clusters.length > chartClusters.length && (
        <p className="timeline-note">Showing first {chartClusters.length} filtered topics to keep the time axis readable.</p>
      )}
    </div>
  )
}

// ─── Live Feed ────────────────────────────────────────────────────────────────
function LiveFeed() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [publisherFilter, setPublisherFilter] = useState('all')
  const [sourceCategoryFilter, setSourceCategoryFilter] = useState('all')
  const [searchFilter, setSearchFilter] = useState('')
  const [publishers, setPublishers] = useState([])
  const [liveCount, setLiveCount] = useState(0)
  const eventSourceRef = useRef(null)

  const fetchArticles = useCallback(async () => {
    try {
      const pub = publisherFilter !== 'all' ? `&publisher=${encodeURIComponent(publisherFilter)}` : ''
      const cat = sourceCategoryFilter !== 'all' ? `&sourceCategory=${encodeURIComponent(sourceCategoryFilter)}` : ''
      const data = await api(`/ingest/live?limit=250${pub}${cat}`)
      setArticles(data)
    } catch {}
  }, [publisherFilter, sourceCategoryFilter])

  useEffect(() => {
    setLoading(true)
    fetchArticles().finally(() => setLoading(false))
  }, [fetchArticles])

  useEffect(() => {
    api('/publishers').then((data) => setPublishers(data || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }
    const es = new EventSource(`${API_BASE_URL}/ingest/live-stream`)
    eventSourceRef.current = es
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'article') {
          setArticles((prev) => [msg.data, ...prev].slice(0, 250))
          setLiveCount((c) => c + 1)
        }
      } catch {}
    }
    return () => { es.close() }
  }, [])

  const filtered = articles.filter((a) => {
    if (publisherFilter !== 'all' && a.publisher !== publisherFilter) return false
    if (sourceCategoryFilter !== 'all' && a.sourceCategory !== sourceCategoryFilter) return false
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase()
      const matchHeadline = (a.headline || '').toLowerCase().includes(q)
      const matchPub = (a.publisher || '').toLowerCase().includes(q)
      if (!matchHeadline && !matchPub) return false
    }
    return true
  })

  const sourceCategories = [
    { id: 'all', label: 'All Sources' },
    { id: 'Indian Media', label: 'Indian Media' },
    { id: 'Indian Government', label: 'Indian Government' },
    { id: 'Indian Regulators', label: 'Indian Regulators' },
    { id: 'International Official Sources', label: 'International Official' },
    { id: 'Existing International Media', label: 'Existing International Media' },
  ]

  return (
    <div className="section-container">
      <div className="section-header">
        <div>
          <p className="eyebrow"><Wifi size={13} /> Live Ingestion Feed</p>
          <h2>Incoming Articles</h2>
          <p className="section-desc">Real-time stream of articles fetched across media, government, and regulatory networks.</p>
        </div>
        <div className="live-feed-actions">
          {liveCount > 0 && <span className="live-badge"><span className="live-dot" />{liveCount} new</span>}
          <input
            className="search-input-sm"
            placeholder="Search headline or publisher..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
          <select
            className="pub-select"
            value={sourceCategoryFilter}
            onChange={(e) => setSourceCategoryFilter(e.target.value)}
          >
            {sourceCategories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select
            className="pub-select"
            value={publisherFilter}
            onChange={(e) => setPublisherFilter(e.target.value)}
          >
            <option value="all">All publishers ({publishers.length})</option>
            {publishers.map((p) => <option key={p._id} value={p.name}>{p.name}</option>)}
          </select>
          <button className="icon-btn" onClick={fetchArticles} title="Refresh"><RefreshCcw size={16} /></button>
        </div>
      </div>

      {loading ? (
        <div className="live-loading"><div className="spinner" /><span>Loading live feed…</span></div>
      ) : !filtered.length ? (
        <div className="empty-state"><Radio size={30} /><p>No articles found matching the selected filters.</p></div>
      ) : (
        <div className="live-feed-table-wrap">
          <table className="live-feed-table">
            <thead>
              <tr>
                <th>Headline</th>
                <th>Publisher</th>
                <th>Category</th>
                <th>Country</th>
                <th>Published</th>
                <th>Ingested</th>
                <th>Lang</th>
                <th>Status</th>
                <th>Cluster</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((art) => (
                <tr key={art.id} className="live-row">
                  <td className="live-headline">
                    <span title={art.headline}>{art.headline}</span>
                    {art.description && <span className="live-desc">{art.description.slice(0, 120)}…</span>}
                  </td>
                  <td><SourceChip source={art.publisher} /></td>
                  <td className="live-category"><span className="cat-pill">{art.sourceCategory || 'Media'}</span></td>
                  <td className="live-country">{art.country || 'Global'}</td>
                  <td className="live-time">{formatDate(art.publicationTimestamp)}</td>
                  <td className="live-time">{formatDate(art.ingestionTimestamp)}</td>
                  <td><span className="lang-badge">{(art.language || 'en').toUpperCase()}</span></td>
                  <td><StatusBadge status={art.processingStatus || 'ingested'} /></td>
                  <td className="live-cluster">
                    {art.clusterAssignment?.clusterLabel
                      ? <span title={art.clusterAssignment.clusterLabel}>{art.clusterAssignment.clusterLabel.slice(0, 50)}</span>
                      : <span className="muted">—</span>}
                  </td>
                  <td>
                    <a href={art.sourceLink} target="_blank" rel="noreferrer" className="ext-link" title="Open article">
                      <ExternalLink size={14} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Publisher Management ─────────────────────────────────────────────────────
function PublisherManagement() {
  const [publishers, setPublishers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', homepageUrl: '', description: '', feedUrl: '', feedName: '', feedCategory: 'General', language: 'en' })
  const [testResult, setTestResult] = useState(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await api('/publishers')
      setPublishers(data || [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function testFeed() {
    if (!form.feedUrl.trim()) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`${API_BASE_URL}/publishers/test-feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: form.feedUrl.trim() }),
      })
      const data = await res.json()
      setTestResult(data)
    } catch (err) {
      setTestResult({ success: false, error: err.message })
    }
    setTesting(false)
  }

  async function addPublisher(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const feeds = form.feedUrl.trim()
        ? [{ url: form.feedUrl.trim(), name: form.feedName || 'Main Feed', category: form.feedCategory, enabled: true }]
        : []
      await api('/publishers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, homepageUrl: form.homepageUrl, description: form.description, language: form.language, feeds }),
      })
      setShowAdd(false)
      setForm({ name: '', homepageUrl: '', description: '', feedUrl: '', feedName: '', feedCategory: 'General', language: 'en' })
      setTestResult(null)
      await load()
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  async function togglePublisher(id) {
    try {
      await api(`/publishers/${id}/toggle`, { method: 'PATCH' })
      await load()
    } catch {}
  }

  async function deletePublisher(id, name) {
    if (!confirm(`Remove publisher "${name}"? This will not delete existing articles.`)) return
    try {
      await api(`/publishers/${id}`, { method: 'DELETE' })
      await load()
    } catch {}
  }

  return (
    <div className="section-container">
      <div className="section-header">
        <div>
          <p className="eyebrow"><Globe size={13} /> Publisher Management</p>
          <h2>Active Publishers</h2>
          <p className="section-desc">Add and manage RSS/Atom feed sources. Only English-language feeds are accepted.</p>
        </div>
        <button className="primary-btn" onClick={() => setShowAdd(true)}><Plus size={16} /> Add Publisher</button>
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal">
            <div className="modal-head">
              <h3>Add New Publisher</h3>
              <button className="icon-btn" onClick={() => setShowAdd(false)}><X size={18} /></button>
            </div>
            <form onSubmit={addPublisher} className="modal-form">
              <div className="form-row">
                <label>Publisher Name *
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. The Hindu" />
                </label>
                <label>Language
                  <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                    <option value="en">English</option>
                  </select>
                </label>
              </div>
              <label>Homepage URL
                <input value={form.homepageUrl} onChange={(e) => setForm({ ...form, homepageUrl: e.target.value })} placeholder="https://example.com" />
              </label>
              <label>Description
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description" />
              </label>
              <div className="form-divider">RSS Feed</div>
              <div className="feed-test-row">
                <label style={{ flex: 1 }}>Feed URL
                  <input value={form.feedUrl} onChange={(e) => setForm({ ...form, feedUrl: e.target.value })} placeholder="https://example.com/feed.rss" />
                </label>
                <button type="button" className="test-btn" onClick={testFeed} disabled={testing || !form.feedUrl.trim()}>
                  {testing ? 'Testing…' : 'Test Feed'}
                </button>
              </div>
              {testResult && (
                <div className={`test-result ${testResult.success ? 'success' : 'fail'}`}>
                  {testResult.success ? (
                    <>
                      <CheckCircle size={15} />
                      <div>
                        <strong>{testResult.data?.title}</strong>
                        <span>{testResult.data?.summary}</span>
                        {testResult.data?.sampleArticles?.map((a, i) => (
                          <div key={i} className="sample-art">{a.isEnglish ? '✓' : '✗'} {a.title}</div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <><AlertCircle size={15} /><span>{testResult.error || 'Feed test failed'}</span></>
                  )}
                </div>
              )}
              <div className="form-row">
                <label>Feed Name
                  <input value={form.feedName} onChange={(e) => setForm({ ...form, feedName: e.target.value })} placeholder="Main Feed" />
                </label>
                <label>Category
                  <input value={form.feedCategory} onChange={(e) => setForm({ ...form, feedCategory: e.target.value })} placeholder="General" />
                </label>
              </div>
              {error && <div className="form-error"><AlertCircle size={14} /> {error}</div>}
              <div className="modal-actions">
                <button type="button" className="ghost-btn" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Adding…' : 'Add Publisher'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="live-loading"><div className="spinner" /><span>Loading publishers…</span></div>
      ) : (
        <div className="publisher-grid">
          {publishers.map((pub) => (
            <div key={pub._id} className={`publisher-card ${pub.enabled ? 'enabled' : 'disabled'}`}>
              <div className="pub-card-head">
                <div className="pub-info">
                  <strong>{pub.name}</strong>
                  <span className="pub-url">{pub.homepageUrl}</span>
                </div>
                <div className="pub-actions">
                  <button
                    className={`toggle-btn ${pub.enabled ? 'on' : 'off'}`}
                    onClick={() => togglePublisher(pub._id)}
                    title={pub.enabled ? 'Disable' : 'Enable'}
                  >
                    {pub.enabled ? 'Active' : 'Paused'}
                  </button>
                  <button className="icon-btn danger" onClick={() => deletePublisher(pub._id, pub.name)} title="Remove publisher"><X size={15} /></button>
                </div>
              </div>
              <div className="pub-stats">
                <span className="cat-pill">{pub.category || 'Media'}</span>
                <span className="country-pill">{pub.country || 'Global'}</span>
                <span><Newspaper size={12} /> {pub.totalStoredCount || pub.articleCount || 0} articles</span>
                <span><Zap size={12} /> {pub.feeds?.length || pub.feedCount || 0} feed{(pub.feeds?.length || pub.feedCount) !== 1 ? 's' : ''}</span>
                <StatusBadge status={pub.health || 'healthy'} />
                {pub.lastIngestionAt && <span className="muted">Last: {formatDate(pub.lastIngestionAt)}</span>}
              </div>
              {pub.feeds?.length > 0 && (
                <div className="pub-feed-list">
                  {pub.feeds.map((f, fi) => (
                    <div key={fi} className="pub-feed-row">
                      <span className="feed-name">{f.name || 'Feed'}</span>
                      <span className="feed-url" title={f.url}>{f.url}</span>
                      <StatusBadge status={f.lastStatus || 'healthy'} />
                      {f.lastError && <span className="feed-err" title={f.lastError}>⚠️ {f.lastError.slice(0, 45)}…</span>}
                    </div>
                  ))}
                </div>
              )}
              {pub.description && <p className="pub-desc">{pub.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Ingestion Monitoring ─────────────────────────────────────────────────────
function IngestionMonitoring() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await api('/ingest/monitoring')
      setData(d)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [load])

  async function triggerIngestion() {
    setTriggering(true)
    try {
      await api('/ingest/trigger', { method: 'POST' })
      await load()
    } catch {}
    setTriggering(false)
  }

  if (loading) return <div className="live-loading"><div className="spinner" /><span>Loading monitoring…</span></div>
  if (!data) return null

  return (
    <div className="section-container">
      <div className="section-header">
        <div>
          <p className="eyebrow"><Server size={13} /> Ingestion Monitoring</p>
          <h2>Publisher & Feed Health</h2>
          <p className="section-desc">Live stats from the backend scheduler and ingestion pipeline. Auto-refreshes every 30s.</p>
        </div>
        <button className="primary-btn" onClick={triggerIngestion} disabled={triggering}>
          <RefreshCcw size={16} className={triggering ? 'spin' : ''} /> {triggering ? 'Running…' : 'Trigger Now'}
        </button>
      </div>

      {/* Scheduler banner */}
      <div className={`scheduler-banner ${data.scheduler?.status === 'running' ? 'running' : 'paused'}`}>
        <div className="sched-info">
          <strong>Scheduler — {data.scheduler?.status || 'unknown'}</strong>
          <span>Polls every {data.scheduler?.intervalMinutes || 1} min · {data.scheduler?.activeSubscribers || 0} SSE subscribers</span>
        </div>
        <div className="sched-times">
          {data.lastIngestion && <span>Last run: {formatDate(data.lastIngestion)}</span>}
          {data.nextScheduledIngestion && <span>Next: {formatDate(data.nextScheduledIngestion)}</span>}
        </div>
      </div>

      {/* Key metrics */}
      <div className="monitor-stat-grid">
        <div className="mon-stat"><span>Active Publishers</span><strong>{data.activePublishers}</strong></div>
        <div className="mon-stat"><span>Total Feeds</span><strong>{data.totalFeeds}</strong></div>
        <div className="mon-stat"><span>Healthy Feeds</span><strong>{data.healthyFeeds}</strong></div>
        <div className="mon-stat"><span>Total Articles</span><strong>{data.totalStoredArticles?.toLocaleString()}</strong></div>
        <div className="mon-stat green"><span>Newly Discovered</span><strong>{data.newlyDiscoveredArticles}</strong></div>
        <div className="mon-stat yellow"><span>Duplicates Skipped</span><strong>{data.duplicateArticlesSkipped}</strong></div>
        <div className="mon-stat red"><span>Failed Feeds</span><strong>{data.failedFeeds}</strong></div>
        <div className="mon-stat"><span>Publishers Total</span><strong>{data.totalPublishers}</strong></div>
      </div>

      {/* Publisher health grid */}
      <h3 className="subsection-title">Publisher Health</h3>
      <div className="pub-health-grid">
        {(data.publishersHealth || []).map((p) => (
          <div key={p.id} className={`pub-health-card ${p.health}`}>
            <div className="phc-head">
              <strong>{p.name}</strong>
              <StatusBadge status={p.health || 'healthy'} />
            </div>
            <div className="phc-stats">
              <span>{p.articleCount} articles</span>
              <span>{p.feedCount} feed{p.feedCount !== 1 ? 's' : ''}</span>
              {!p.enabled && <span className="badge-gray">Disabled</span>}
            </div>
            {p.lastIngestionAt && <span className="phc-time">Last: {formatDate(p.lastIngestionAt)}</span>}
          </div>
        ))}
      </div>

      {/* Recent history */}
      <h3 className="subsection-title">Recent Ingestion History</h3>
      <div className="history-table-wrap">
        <table className="history-table">
          <thead>
            <tr><th>Started</th><th>Finished</th><th>Triggered by</th><th>Inserted</th><th>Duplicates</th><th>Clusters</th><th>Status</th><th>Notes</th></tr>
          </thead>
          <tbody>
            {(data.recentIngestionHistory || []).map((job) => (
              <tr key={job.id}>
                <td className="live-time">{formatDate(job.startedAt)}</td>
                <td className="live-time">{job.finishedAt ? formatDate(job.finishedAt) : '—'}</td>
                <td>{job.triggeredBy}</td>
                <td>{job.insertedCount}</td>
                <td>{job.duplicateCount}</td>
                <td>{job.clusterCount}</td>
                <td><StatusBadge status={job.status} /></td>
                <td className="muted" style={{ maxWidth: 220 }}>{job.error || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Narrative Intelligence ───────────────────────────────────────────────────
function NarrativeIntelligence() {
  const [clusters, setNarrativeClusters] = useState([])
  const [liveArticles, setLiveArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [publisherFilter, setPublisherFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [reviewFilter, setReviewFilter] = useState('All')
  const [publishers, setPublishers] = useState([])
  const [runInfo, setRunInfo] = useState(null)

  const load = useCallback(async () => {
    try {
      // Load clusters (the main narrative data)
      const clusterData = await api('/clusters/playground?threshold=0.26')
      const allClusters = clusterData?.clusters || []
      setNarrativeClusters(allClusters)

      // Collect run metadata from ingest summary
      const summary = await api('/ingest/summary').catch(() => null)
      if (summary) setRunInfo(summary)

      // Load recent articles for the live feed strip
      const arts = await api('/ingest/live?limit=20').catch(() => [])
      setLiveArticles(Array.isArray(arts) ? arts : [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    api('/publishers').then((d) => setPublishers(d || [])).catch(() => {})
  }, [load])

  // Derive unique categories from cluster topTerms
  const categories = useMemo(() => {
    const cats = new Set()
    clusters.forEach((c) => (c.topTerms || []).forEach((t) => cats.add(t)))
    return ['All', ...Array.from(cats).slice(0, 20)]
  }, [clusters])

  const pubNames = useMemo(() => ['All', ...publishers.map((p) => p.name)], [publishers])

  const visible = clusters.filter((n) => {
    if (publisherFilter !== 'All' && !n.sources.includes(publisherFilter)) return false
    if (categoryFilter !== 'All' && !(n.topTerms || []).includes(categoryFilter)) return false
    if (reviewFilter === 'GROUPED' && n.articleCount <= 1) return false
    if (reviewFilter === 'CROSS_SOURCE' && n.sources.length <= 1) return false
    if (reviewFilter === 'SINGLE' && n.articleCount !== 1) return false
    return true
  })

  const reviewOptions = ['All', 'GROUPED', 'CROSS_SOURCE', 'SINGLE']

  if (loading) return (
    <div className="section-container">
      <div className="live-loading"><div className="spinner" /><span>Loading narrative intelligence…</span></div>
    </div>
  )

  return (
    <div className="section-container">
      <div className="section-header">
        <div>
          <p className="eyebrow"><BrainCircuit size={13} /> Narrative Intelligence</p>
          <h2>Story Narratives</h2>
          <p className="section-desc">TF-IDF narrative clusters assembled from live RSS ingestion across all publishers.</p>
        </div>
        <button className="icon-btn" onClick={load} title="Refresh"><RefreshCcw size={16} /></button>
      </div>

      {/* Run metadata bar */}
      {runInfo && (
        <div className="narrative-run-bar">
          {runInfo.lastSuccessfulCollectionAt && (
            <span><Clock3 size={12} /> Latest run: <strong>{formatDate(runInfo.lastSuccessfulCollectionAt)}</strong></span>
          )}
          <span><Layers size={12} /> {clusters.length} topics</span>
          <span><Newspaper size={12} /> {runInfo.totalStoredArticles || 0} articles</span>
          <span><GitBranch size={12} /> {publishers.length} publishers</span>
        </div>
      )}

      {/* Live feed strip — newest articles */}
      {liveArticles.length > 0 && (
        <div className="ni-live-strip">
          <p className="eyebrow"><Wifi size={12} /> Live feed — newest articles</p>
          <div className="ni-live-scroll">
            {liveArticles.map((art) => (
              <div key={art.id} className="ni-live-item">
                <SourceChip source={art.publisher} />
                <span className="ni-live-title">{art.headline}</span>
                <span className="ni-live-time">{formatDate(art.publicationTimestamp)}</span>
                <StatusBadge status={art.processingStatus || 'ingested'} />
                <a href={art.sourceLink} target="_blank" rel="noreferrer" className="ext-link" title="Open article">
                  <ExternalLink size={12} />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="narrative-filters">
        <div className="nf-group">
          <label>Story Type</label>
          <select value={reviewFilter} onChange={(e) => setReviewFilter(e.target.value)}>
            {reviewOptions.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="nf-group">
          <label>Publisher</label>
          <select value={publisherFilter} onChange={(e) => setPublisherFilter(e.target.value)}>
            {pubNames.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="nf-group">
          <label>Topic Term</label>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <span className="nf-count">{visible.length} of {clusters.length} narratives</span>
      </div>

      {!visible.length ? (
        <div className="empty-state"><BrainCircuit size={30} /><p>No narratives match the current filters. Try adjusting filters or trigger a data refresh.</p></div>
      ) : (
        <div className="narrative-grid">
          {visible.map((n) => {
            const isCross = n.sources.length > 1
            const isGrouped = n.articleCount > 1
            const badge = isCross ? 'CROSS-SOURCE' : isGrouped ? 'GROUPED' : 'SINGLE'
            const badgeClass = isCross ? 'nc-type cross' : isGrouped ? 'nc-type grouped' : 'nc-type single'
            return (
              <div key={n.id} className={`narrative-card ${sourceClass(n.sources)}`}>
                <div className="nc-head">
                  <span className={badgeClass}>{badge}</span>
                  <span className="nc-members">
                    <Newspaper size={11} /> {n.articleCount} · <GitBranch size={11} /> {n.sources.length} src
                  </span>
                </div>
                <h3 className="nc-label">{n.label}</h3>
                <div className="nc-categories">
                  {(n.topTerms || []).slice(0, 5).map((c) => <span key={c} className="nc-cat">{c}</span>)}
                </div>
                <div className="nc-footer">
                  <SourceChips sources={n.sources} />
                  <span className="nc-time"><Clock3 size={11} /> {formatDate(n.endTime)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Article Detail ───────────────────────────────────────────────────────────
function ArticleConstellation({ articles }) {
  return (
    <div className="article-constellation">
      {articles.map((article, index) => (
        <article className={`article-node node-${index % 5}`} key={article.id}>
          <div className="article-meta">
            <span>{article.source}</span>
            <span>{formatDate(article.publishedAt)}</span>
          </div>
          <h3>{article.title}</h3>
          <p>{article.summary || article.body?.slice(0, 240) || 'No summary available.'}</p>
          <a href={article.url} target="_blank" rel="noreferrer">Read original <ExternalLink size={14} /></a>
        </article>
      ))}
    </div>
  )
}

function DetailSignalMap({ cluster }) {
  const articles = cluster.articles || []
  const visible = articles.slice(0, 5)
  const hidden = Math.max(articles.length - visible.length, 0)
  return (
    <div className="detail-evidence-panel">
      <div className="evidence-score">
        <BrainCircuit size={22} />
        <div><strong>{mlConfidence(cluster)}%</strong><span>Match strength</span></div>
      </div>
      <div className="evidence-sources">
        <span>Source coverage</span>
        <SourceChips sources={cluster.sources} />
      </div>
      <div className="evidence-articles">
        {visible.map((article) => (
          <a
            className={`evidence-article-node ${article.source?.toLowerCase().replace(/\s+/g, '-') || 'unknown'}`}
            href={article.url} key={article.id} rel="noreferrer" target="_blank" title={article.title}
          >
            <span>{article.source?.slice(0, 1) || 'N'}</span>
            <strong>{article.source || 'News'}</strong>
          </a>
        ))}
        {hidden > 0 && <span className="evidence-more">+{hidden}</span>}
      </div>
    </div>
  )
}

function ClusterDetailPage({ cluster, loading, onBack }) {
  if (loading) return (
    <main className="app-shell">
      <div className="top-loader" aria-hidden="true" />
      <div className="detail-page loading-page texture-surface"><div className="loading-pulse" /><p>Loading grouped story…</p></div>
    </main>
  )
  if (!cluster) return (
    <main className="app-shell">
      <div className="detail-page loading-page texture-surface">
        <AlertCircle size={28} /><p>Cluster not found.</p>
        <button className="texture-button" onClick={onBack} type="button"><ArrowLeft size={17} /> Back to dashboard</button>
      </div>
    </main>
  )

  const isSingle = clusterKind(cluster) === 'single'
  const confidence = mlConfidence(cluster)
  return (
    <main className="app-shell detail-shell">
      <button className="back-link" onClick={onBack} type="button"><ArrowLeft size={18} /> Back to cluster map</button>
      <div className={`detail-hero texture-surface ${sourceClass(cluster.sources)}`}>
        <div className="detail-hero-copy">
          <p className="eyebrow">{isSingle ? 'Single article' : 'Grouped topic'}</p>
          <h1>{cluster.label}</h1>
          <div className="detail-facts">
            <span><Layers size={15} /> {cluster.articleCount} article{cluster.articleCount === 1 ? '' : 's'}</span>
            <span><CalendarDays size={15} /> {formatDate(cluster.startTime)} – {formatDate(cluster.endTime)}</span>
            <span><GitBranch size={15} /> {cluster.sources.length} source{cluster.sources.length === 1 ? '' : 's'}</span>
            <span><BrainCircuit size={15} /> {confidence}% match strength</span>
          </div>
        </div>
        <div className="detail-orbit" aria-hidden="true"><span>{confidence}%</span></div>
      </div>
      <section className="detail-grid">
        <div className="explain-card texture-surface">
          <p className="eyebrow">Model evidence</p>
          {cluster.topTerms?.length > 0 ? (
            <>
              <p className="explain-copy">These stories crossed the TF-IDF similarity threshold using shared weighted terms and overlapping source context.</p>
              <div className="term-row">{cluster.topTerms.map((term) => <span key={term}>{term}</span>)}</div>
            </>
          ) : (
            <p className="explain-copy">This is a single article, so it is shown as its own topic until another story is similar enough to join it.</p>
          )}
          <DetailSignalMap cluster={cluster} />
          <SourceChips sources={cluster.sources} />
        </div>
        <div className="article-map-card texture-surface">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Article evidence</p>
              <h2>{isSingle ? 'One report' : 'Reports behind this cluster'}</h2>
            </div>
            <span>{cluster.articleCount} total</span>
          </div>
          <ArticleConstellation articles={cluster.articles || []} />
        </div>
      </section>
    </main>
  )
}

// ─── Main Dashboard (Cluster / Signal / Timeline views) ──────────────────────
function Dashboard({ darkMode, onToggleDark, onRefresh, refreshing }) {
  const [clusters, setClusters] = useState([])
  const [publishers, setPublishers] = useState([])
  const [selectedSources, setSelectedSources] = useState([])
  const [viewMode, setViewMode] = useState('grouped')
  const [visualMode, setVisualMode] = useState('board')
  const [dateMode, setDateMode] = useState('all')
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD)
  const [searchQuery, setSearchQuery] = useState('')
  const [crossSourceOnly, setCrossSourceOnly] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [selectedCluster, setSelectedCluster] = useState(null)
  const [page, setPage] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [ingestionPhase, setIngestionPhase] = useState('fetch')
  const [pageNumber, setPageNumber] = useState(1)
  const [status, setStatus] = useState('Ready')
  const [error, setError] = useState('')
  const [ingestSummary, setIngestSummary] = useState(null)

  const sourceQuery = selectedSources.length ? `?sources=${encodeURIComponent(selectedSources.join(','))}` : ''

  const loadTimeline = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const sep = sourceQuery ? '&' : '?'
      const data = await api(`/clusters/playground${sourceQuery}${sep}threshold=${threshold.toFixed(2)}`)
      setClusters(data.clusters)
      setStatus(`${data.clusters.length} topics at ${data.threshold.toFixed(2)} similarity`)
    } catch (err) {
      setError(err.message)
      setStatus('Unable to load timeline')
    } finally {
      setLoading(false)
    }
  }, [sourceQuery, threshold])

  const loadCluster = useCallback(async (id) => {
    if (!id) { setSelectedCluster(null); return }
    setDetailLoading(true)
    try {
      const data = await api(`/clusters/${id}`)
      setSelectedCluster(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const loadPublishers = useCallback(async () => {
    try {
      const data = await api('/publishers')
      setPublishers(data || [])
      if (selectedSources.length === 0) setSelectedSources(data.map((p) => p.name))
    } catch {}
  }, [])

  const loadSummary = useCallback(async () => {
    try {
      const d = await api('/ingest/summary')
      setIngestSummary(d)
    } catch {}
  }, [])

  async function handleRefresh() {
    onRefresh && onRefresh()
    setIngestionPhase('fetch')
    setError('')
    try {
      const job = await api('/ingest/trigger', { method: 'POST' })
      setStatus('Fetching articles from feeds')
      let current = job
      let pollCount = 0
      while (current.status === 'pending' || current.status === 'running') {
        await new Promise((r) => setTimeout(r, 2000))
        current = await api(`/ingest/status/${job.jobId}`)
        pollCount++
        const nextPhase = INGESTION_STEPS[Math.min(pollCount, INGESTION_STEPS.length - 1)]?.id || 'cluster'
        setIngestionPhase(nextPhase)
        setStatus(`${INGESTION_STEPS.find((s) => s.id === nextPhase)?.label || 'Processing'} in progress`)
      }
      if (current.status === 'failed') throw new Error(current.error || 'Ingestion failed')
      setIngestionPhase('cluster')
      setStatus(`Rebuilt ${current.clusterCount} topics`)
      await loadTimeline()
      await loadSummary()
    } catch (err) {
      setError(err.message)
      setStatus('Refresh failed')
    }
  }

  function openCluster(cluster) {
    if (cluster?.articles) { setSelectedCluster(cluster); setSelectedId(null) }
    else { setSelectedCluster(null); setSelectedId(cluster?.id) }
    setPage('detail')
  }

  function toggleSource(source) {
    setSelectedSources((cur) =>
      cur.includes(source) ? cur.filter((s) => s !== source) : [...cur, source]
    )
  }

  useEffect(() => { loadPublishers() }, [loadPublishers])
  useEffect(() => { loadTimeline() }, [loadTimeline])
  useEffect(() => { loadSummary() }, [loadSummary])
  useEffect(() => { setPageNumber(1) }, [crossSourceOnly, dateMode, searchQuery, selectedSources, threshold, viewMode, visualMode])
  useEffect(() => { if (selectedId) loadCluster(selectedId) }, [loadCluster, selectedId])

  // Auto-refresh cluster board when ingestion completes
  useEffect(() => {
    const es = new EventSource(`${API_BASE_URL}/ingest/live-stream`)
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'ingest_completed') {
          loadTimeline()
          loadSummary()
        }
      } catch {}
    }
    return () => es.close()
  }, [loadTimeline, loadSummary])

  const stats = useMemo(() => {
    const grouped = clusters.filter((c) => c.articleCount > 1)
    const singles = clusters.filter((c) => c.articleCount === 1)
    const crossSource = grouped.filter((c) => c.sources.length > 1)
    return { total: clusters.length, grouped: grouped.length, singles: singles.length, crossSource: crossSource.length }
  }, [clusters])

  const visibleClusters = useMemo(() => {
    const dateFilter = DATE_MODES.find((m) => m.id === dateMode)
    const cutoff = dateFilter?.hours ? Date.now() - dateFilter.hours * 60 * 60 * 1000 : null
    const query = searchQuery.trim().toLowerCase()
    return [...clusters]
      .filter((c) => {
        if (viewMode === 'grouped' && c.articleCount <= 1) return false
        if (viewMode === 'single' && c.articleCount !== 1) return false
        if (crossSourceOnly && c.sources.length <= 1) return false
        if (cutoff && timeValue(c.endTime) < cutoff) return false
        if (!query) return true
        return [c.label, ...(c.topTerms || []), ...c.sources].join(' ').toLowerCase().includes(query)
      })
      .sort((a, b) => {
        if (visualMode === 'board' || visualMode === 'map') return b.articleCount - a.articleCount || timeValue(b.endTime) - timeValue(a.endTime)
        return timeValue(b.endTime) - timeValue(a.endTime)
      })
  }, [clusters, crossSourceOnly, dateMode, searchQuery, viewMode, visualMode])

  const pageCount = Math.max(1, Math.ceil(visibleClusters.length / PAGE_SIZE))
  const safePageNumber = Math.min(pageNumber, pageCount)
  const pagedClusters = useMemo(() => {
    const start = (safePageNumber - 1) * PAGE_SIZE
    return visibleClusters.slice(start, start + PAGE_SIZE)
  }, [safePageNumber, visibleClusters])

  if (page === 'detail') {
    return <ClusterDetailPage cluster={selectedCluster} loading={detailLoading} onBack={() => setPage('dashboard')} />
  }

  return (
    <div className="dashboard-content">
      {/* RSS Collection header */}
      <div className="rss-collection-bar">
        <div className="rss-left">
          <span className="eyebrow"><Newspaper size={13} /> RSS collection</span>
          {ingestSummary && (
            <div className="rss-stats">
              <span>Total stored articles <strong>{ingestSummary.totalStoredArticles}</strong></span>
              <span>Newly discovered <strong>{ingestSummary.newlyDiscovered}</strong></span>
              <span>Duplicate articles skipped <strong>{ingestSummary.duplicateArticlesSkipped}</strong></span>
              <span>Failed feed requests <strong>{ingestSummary.failedFeedRequests || 0}</strong></span>
              {ingestSummary.lastSuccessfulCollectionAt && (
                <span>Last successful collection <strong>{formatDate(ingestSummary.lastSuccessfulCollectionAt)}</strong></span>
              )}
            </div>
          )}
        </div>
        <button className="auto-badge">Automatic · every 1 min</button>
      </div>

      {/* Stat cards */}
      <div className="metric-grid">
        <div className="stat-card texture-surface"><Activity size={18} /><div><span>Topics analyzed</span><strong>{stats.total}</strong></div></div>
        <div className="stat-card texture-surface"><Layers size={18} /><div><span>Grouped stories</span><strong>{stats.grouped}</strong></div></div>
        <div className="stat-card texture-surface"><TrendingUp size={18} /><div><span>Cross-source</span><strong>{stats.crossSource}</strong></div></div>
        <div className="stat-card texture-surface"><Search size={18} /><div><span>Single articles</span><strong>{stats.singles}</strong></div></div>
      </div>

      {/* Controls */}
      <div className="control-deck texture-surface">
        <div className="filter-row">
          <div className="filter-group" aria-label="Source filters">
            <Filter size={17} />
            {publishers.map((pub) => (
              <button
                className={selectedSources.includes(pub.name) ? 'active' : ''}
                key={pub._id}
                onClick={() => toggleSource(pub.name)}
                type="button"
              >
                {pub.name}
              </button>
            ))}
          </div>
          <label className="search-box">
            <Search size={16} />
            <input onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search topics, keywords, publishers..." type="search" value={searchQuery} />
          </label>
          <label className="check-filter">
            <input checked={crossSourceOnly} onChange={(e) => setCrossSourceOnly(e.target.checked)} type="checkbox" />
            Cross-source only
          </label>
        </div>
        <div className="filter-row compact">
          <SegmentedControl label="Topic scope" onChange={setViewMode} options={VIEW_MODES} value={viewMode} />
          <SegmentedControl label="Visualization" onChange={setVisualMode} options={VISUAL_MODES} value={visualMode} />
          <SegmentedControl label="Date range" onChange={setDateMode} options={DATE_MODES} value={dateMode} />
          <div className="status-line"><Clock3 size={16} /><span>{status}</span></div>
        </div>
        <div className="threshold-playground">
          <div className="threshold-copy">
            <p className="eyebrow"><SlidersHorizontal size={13} /> Similarity playground</p>
            <strong>TF-IDF threshold {threshold.toFixed(2)}</strong>
          </div>
          <div className="threshold-control">
            <button aria-label="Loosen" className="threshold-step" onClick={() => setThreshold((v) => Math.max(0.05, Number((v - 0.01).toFixed(2))))} type="button"><Minus size={15} /></button>
            <span>Loose</span>
            <input aria-label="TF-IDF threshold" max="0.65" min="0.05" onChange={(e) => setThreshold(Number(e.target.value))} step="0.01" type="range" value={threshold} />
            <span>Strict</span>
            <button aria-label="Tighten" className="threshold-step" onClick={() => setThreshold((v) => Math.min(0.65, Number((v + 0.01).toFixed(2))))} type="button"><Plus size={15} /></button>
          </div>
          <button className="reset-threshold" onClick={() => setThreshold(DEFAULT_THRESHOLD)} type="button">Reset</button>
        </div>
      </div>

      {error && <div className="error-banner"><AlertCircle size={18} /><span>{error}</span></div>}

      {refreshing && (
        <div className="ingestion-strip">
          <div>
            <strong>Ingestion running</strong>
            <span>{status}</span>
          </div>
          <div className="ingestion-pipeline">
            {INGESTION_STEPS.map((step, index) => {
              const activeIndex = Math.max(0, INGESTION_STEPS.findIndex((s) => s.id === ingestionPhase))
              const Icon = step.icon
              return (
                <span
                  className={`${index < activeIndex ? 'complete' : ''} ${index === activeIndex ? 'active' : ''}`}
                  key={step.id}
                >
                  <Icon size={15} /> {step.label}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Visual panel */}
      <div className="visual-panel texture-surface">
        <div className="panel-heading">
          <div>
            <p className="eyebrow"><SlidersHorizontal size={13} /> {VISUAL_MODES.find((m) => m.id === visualMode)?.label}</p>
            <h2>{VIEW_MODES.find((m) => m.id === viewMode)?.label}</h2>
          </div>
          <span>{loading ? 'Loading' : `${visibleClusters.length} shown`}</span>
        </div>
        {loading ? (
          <div className="live-loading"><div className="spinner" /><span>Building cluster view…</span></div>
        ) : visualMode === 'board' ? (
          <>
            {visibleClusters.length > PAGE_SIZE && (
              <div className="pagination-bar">
                <span>{(safePageNumber - 1) * PAGE_SIZE + 1}–{Math.min(safePageNumber * PAGE_SIZE, visibleClusters.length)} of {visibleClusters.length}</span>
                <div className="pagination-actions">
                  <button disabled={safePageNumber <= 1} onClick={() => setPageNumber(safePageNumber - 1)} type="button">Previous</button>
                  <strong>{safePageNumber} / {pageCount}</strong>
                  <button disabled={safePageNumber >= pageCount} onClick={() => setPageNumber(safePageNumber + 1)} type="button">Next</button>
                </div>
              </div>
            )}
            <ClusterBoard clusters={pagedClusters} onOpen={openCluster} />
          </>
        ) : visualMode === 'map' ? (
          <>
            {visibleClusters.length > PAGE_SIZE && (
              <div className="pagination-bar">
                <span>{(safePageNumber - 1) * PAGE_SIZE + 1}–{Math.min(safePageNumber * PAGE_SIZE, visibleClusters.length)} of {visibleClusters.length}</span>
                <div className="pagination-actions">
                  <button disabled={safePageNumber <= 1} onClick={() => setPageNumber(safePageNumber - 1)} type="button">Previous</button>
                  <strong>{safePageNumber} / {pageCount}</strong>
                  <button disabled={safePageNumber >= pageCount} onClick={() => setPageNumber(safePageNumber + 1)} type="button">Next</button>
                </div>
              </div>
            )}
            <SignalMap clusters={pagedClusters} onOpen={openCluster} />
          </>
        ) : (
          <Timeline clusters={visibleClusters} onOpen={openCluster} />
        )}
      </div>
    </div>
  )
}

// ─── App Shell ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'live-feed', label: 'Live feed', icon: Wifi },
  { id: 'cluster-board', label: 'Cluster board', icon: LayoutDashboard },
  { id: 'signal-map', label: 'Signal map', icon: Radio },
  { id: 'timeline', label: 'Timeline', icon: Activity },
  { id: 'narrative', label: 'Narrative intelligence', icon: BrainCircuit },
]

export default function App() {
  const [activeSection, setActiveSection] = useState('cluster-board')
  const [darkMode, setDarkMode] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  // Map nav section to visual mode for dashboard
  const dashboardSection = ['cluster-board', 'signal-map', 'timeline'].includes(activeSection)
  const visualModeFromNav = activeSection === 'signal-map' ? 'map' : activeSection === 'timeline' ? 'timeline' : 'board'

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await api('/ingest/trigger', { method: 'POST' })
    } catch {}
    setTimeout(() => setRefreshing(false), 2000)
  }

  return (
    <div className={`app-root ${darkMode ? 'dark' : 'light'}`}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon"><Radio size={20} /></div>
          <div>
            <h1>Rumor Flow</h1>
            <span className="brand-sub">TRACKER</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <span className="nav-section-label">VISUALIZATION MODE</span>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
                onClick={() => setActiveSection(item.id)}
                type="button"
              >
                <Icon size={16} />
                {item.label}
              </button>
            )
          })}
        </nav>

        {dashboardSection && (
          <>
            <div className="sidebar-divider" />
            <div className="sidebar-section">
              <span className="nav-section-label">STORY SCOPE</span>
              <div className="sidebar-scope-hint">Use filters in the main area</div>
            </div>
          </>
        )}

        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setActiveSection('publishers')} type="button">
            <Globe size={16} /> Publisher Mgmt
          </button>
          <button className="nav-item" onClick={() => setActiveSection('monitoring')} type="button">
            <Server size={16} /> Monitoring
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="main-area">
        {/* Top bar */}
        <header className="topbar">
          <div className="topbar-left">
            <span className="topbar-section">{NAV_ITEMS.find((n) => n.id === activeSection)?.label || activeSection}</span>
          </div>
          <div className="topbar-right">
            <button
              className="mode-toggle"
              onClick={() => setDarkMode((d) => !d)}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
            <button className="refresh-btn" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCcw size={16} className={refreshing ? 'spin' : ''} />
              {refreshing ? 'Refreshing…' : 'Refresh data'}
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="content-area">
          {activeSection === 'live-feed' && <LiveFeed />}
          {(activeSection === 'cluster-board' || activeSection === 'signal-map' || activeSection === 'timeline') && (
            <Dashboard darkMode={darkMode} onToggleDark={() => setDarkMode((d) => !d)} onRefresh={handleRefresh} refreshing={refreshing} />
          )}
          {activeSection === 'narrative' && <NarrativeIntelligence />}
          {activeSection === 'publishers' && <PublisherManagement />}
          {activeSection === 'monitoring' && <IngestionMonitoring />}
        </main>
      </div>
    </div>
  )
}
