import { useEffect, useMemo, useState } from 'react'
import { getData, putData } from '../../api/client'
import { speak, makeId } from '../../lib/util'

const EMPTY = { term: '', meaning: '', example: '', exampleVi: '', topic: '' }

export default function Vocabulary() {
  const [words, setWords] = useState([])
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [query, setQuery] = useState('')
  const [topicFilter, setTopicFilter] = useState('all')

  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [confirmId, setConfirmId] = useState(null)

  useEffect(() => {
    getData('vocabulary')
      .then((d) => setWords(Array.isArray(d) ? d : []))
      .catch((e) => setLoadError(e.message || 'Không tải được từ vựng.'))
  }, [])

  const topics = useMemo(() => Array.from(new Set(words.map((w) => w.topic).filter(Boolean))), [words])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return words.filter((w) => {
      if (topicFilter !== 'all' && w.topic !== topicFilter) return false
      if (!q) return true
      return (
        w.term?.toLowerCase().includes(q) ||
        w.meaning?.toLowerCase().includes(q) ||
        w.example?.toLowerCase().includes(q) ||
        w.exampleVi?.toLowerCase().includes(q)
      )
    })
  }, [words, query, topicFilter])

  const persist = (next) => {
    setWords(next)
    putData('vocabulary', next).catch((e) => setSaveError(e.message || 'Lưu thất bại.'))
  }

  const resetForm = () => { setForm(EMPTY); setEditingId(null); setSaveError('') }

  const submit = () => {
    const term = form.term.trim()
    const meaning = form.meaning.trim()
    if (!term || !meaning) { setSaveError('Cần nhập ít nhất Từ và Nghĩa.'); return }
    const topic = form.topic.trim() || 'Khác'
    const example = form.example.trim()
    const exampleVi = form.exampleVi.trim()
    if (editingId) {
      persist(words.map((w) => (w.id === editingId ? { ...w, term, meaning, example, exampleVi, topic } : w)))
    } else {
      persist([...words, { id: makeId(term), term, meaning, example, exampleVi, topic, learned: false }])
    }
    resetForm()
  }

  const startEdit = (w) => {
    setEditingId(w.id)
    setForm({ term: w.term || '', meaning: w.meaning || '', example: w.example || '', exampleVi: w.exampleVi || '', topic: w.topic || '' })
    setConfirmId(null)
    setSaveError('')
  }

  const remove = (id) => {
    persist(words.filter((w) => w.id !== id))
    setConfirmId(null)
    if (editingId === id) resetForm()
  }

  const toggleLearned = (id) => {
    persist(words.map((w) => (w.id === id ? { ...w, learned: !w.learned } : w)))
  }

  const learnedCount = words.filter((w) => w.learned).length

  return (
    <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto w-full max-w-4xl min-w-0 space-y-6">
        {/* HEADER */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="glow-accent text-2xl font-bold tracking-[0.18em] sm:text-3xl">KHO TỪ VỰNG</h1>
            <p className="hud-label mt-2 flex items-center gap-2 text-dim">
              <span className="status-dot inline-block h-2 w-2 rounded-full bg-neon shadow-[0_0_8px_var(--color-neon)]" />
              QUẢN LÝ & TRA CỨU VỐN TỪ
            </p>
          </div>
          <div className="panel hud-corners flex items-baseline gap-2 px-5 py-3">
            <span className="glow-neon text-2xl font-bold tabular-nums">{words.length}</span>
            <span className="hud-label text-dim">TỪ · {topics.length} CHỦ ĐỀ</span>
          </div>
        </header>

        {loadError && <div className="panel panel-accent px-4 py-3 text-sm text-accent">{loadError}</div>}

        {/* ADD / EDIT FORM */}
        <div className="panel hud-corners space-y-3 px-4 py-4">
          <p className="hud-label text-accent/80">{editingId ? 'SỬA TỪ' : 'THÊM TỪ MỚI'}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={form.term}
              onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))}
              placeholder="Từ tiếng Anh *"
              className="bg-surface-2 border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-neon"
            />
            <input
              value={form.meaning}
              onChange={(e) => setForm((f) => ({ ...f, meaning: e.target.value }))}
              placeholder="Nghĩa tiếng Việt *"
              className="bg-surface-2 border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-neon"
            />
            <input
              value={form.example}
              onChange={(e) => setForm((f) => ({ ...f, example: e.target.value }))}
              placeholder="Câu ví dụ tiếng Anh (tùy chọn)"
              className="bg-surface-2 border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-neon sm:col-span-2"
            />
            <input
              value={form.exampleVi}
              onChange={(e) => setForm((f) => ({ ...f, exampleVi: e.target.value }))}
              placeholder="Dịch câu ví dụ (tùy chọn)"
              className="bg-surface-2 border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-neon sm:col-span-2"
            />
            <input
              value={form.topic}
              onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
              placeholder="Chủ đề (vd: Công việc)"
              list="vocab-topics"
              className="bg-surface-2 border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-neon"
            />
            <datalist id="vocab-topics">
              {topics.map((t) => <option key={t} value={t} />)}
            </datalist>
          </div>
          {saveError && <p className="text-xs text-accent">{saveError}</p>}
          <div className="flex gap-3">
            <button
              onClick={submit}
              className="border border-neon/60 px-4 py-2 text-xs tracking-wider text-neon transition-colors hover:bg-neon/10"
            >
              {editingId ? 'CẬP NHẬT ▸' : 'THÊM ▸'}
            </button>
            {editingId && (
              <button onClick={resetForm} className="px-4 py-2 text-xs tracking-wider text-dim hover:text-ink">
                HỦY SỬA
              </button>
            )}
          </div>
        </div>

        {/* SEARCH + FILTER */}
        <div className="panel flex min-w-0 flex-wrap items-center gap-3 px-4 py-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 Tìm từ, nghĩa, ví dụ..."
            className="min-w-[12rem] flex-1 bg-surface-2 border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-neon"
          />
          <select
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            className="min-w-0 flex-1 bg-surface-2 border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-neon sm:flex-none"
          >
            <option value="all">Tất cả chủ đề</option>
            {topics.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <span className="hud-label text-dim">{filtered.length} / {words.length}</span>
        </div>

        {/* LIST */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="panel hud-corners px-5 py-8 text-center text-dim">
              {words.length === 0 ? 'Chưa có từ nào. Thêm từ đầu tiên ở trên.' : 'Không tìm thấy từ phù hợp.'}
            </div>
          ) : (
            filtered.map((w) => (
              <div key={w.id} className="panel flex min-w-0 flex-wrap items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-bold text-neon">{w.term}</span>
                    <button onClick={() => speak(w.term)} className="text-dim hover:text-neon" title="Đọc to" aria-label="Đọc to">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                      </svg>
                    </button>
                    <span className="text-ink">— {w.meaning}</span>
                    {w.topic && <span className="border border-edge px-2 py-0.5 text-[10px] text-neon/70">{w.topic}</span>}
                    {w.learned && <span className="hud-label text-neon">✓ THUỘC</span>}
                  </div>
                  {w.example && (
                    <div className="mt-1 space-y-1 text-sm text-dim">
                      <p className="italic">“{w.example}”</p>
                      {w.exampleVi && <p>{w.exampleVi}</p>}
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-wrap gap-2 sm:shrink-0">
                  <button
                    onClick={() => toggleLearned(w.id)}
                    className="border border-edge px-2 py-1 text-[10px] tracking-wider text-dim transition-colors hover:text-neon"
                    title="Đánh dấu đã/chưa thuộc"
                  >
                    {w.learned ? '↺ CHƯA' : '✓ THUỘC'}
                  </button>
                  <button
                    onClick={() => startEdit(w)}
                    className="border border-edge px-2 py-1 text-[10px] tracking-wider text-dim transition-colors hover:text-ink"
                  >
                    SỬA
                  </button>
                  {confirmId === w.id ? (
                    <button
                      onClick={() => remove(w.id)}
                      className="border border-accent bg-accent/15 px-2 py-1 text-[10px] tracking-wider text-accent glow-accent"
                    >
                      CHẮC CHẮN?
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmId(w.id)}
                      className="border border-edge px-2 py-1 text-[10px] tracking-wider text-dim transition-colors hover:text-accent"
                    >
                      XÓA
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
