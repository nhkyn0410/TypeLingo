import { useEffect, useMemo, useState } from 'react'
import { defineVocabulary, getData, getProviders, putData } from '../../api/client'
import { speak, makeId } from '../../lib/util'
import { collectEnglishTerms, mergeVocabulary, newTermsAmong, normalizeWord } from '../translate/vocabularyExtract'

const EMPTY = { term: '', meaning: '', example: '', exampleVi: '', topic: '' }

function normalizeEntry(term) {
  return normalizeWord(term)
}

export default function Vocabulary() {
  const [words, setWords] = useState([])
  const [providers, setProviders] = useState([])
  const [aiProvider, setAiProvider] = useState('')
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [topicFilter, setTopicFilter] = useState('all')
  const [learnedFilter, setLearnedFilter] = useState('all')

  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [confirmId, setConfirmId] = useState(null)

  const [extractText, setExtractText] = useState('')
  const [extractTopic, setExtractTopic] = useState('Từ trích xuất')
  const [extractLimit, setExtractLimit] = useState(40)
  const [extractPreview, setExtractPreview] = useState([])
  const [extractBusy, setExtractBusy] = useState(false)

  useEffect(() => {
    getData('vocabulary')
      .then((d) => setWords(Array.isArray(d) ? d : []))
      .catch((e) => setLoadError(e.message || 'Không tải được từ vựng.'))
    getProviders()
      .then((data) => {
        const list = Array.isArray(data?.providers) ? data.providers : []
        setProviders(list)
        const def = list.find((p) => p.isDefault && p.configured) || list.find((p) => p.configured)
        if (def) setAiProvider(def.name)
      })
      .catch(() => setProviders([]))
  }, [])

  const topics = useMemo(() => Array.from(new Set(words.map((w) => w.topic).filter(Boolean))), [words])
  const learnedCount = words.filter((w) => w.learned).length
  const missingMeaningCount = words.filter((w) => w.term && !w.meaning).length

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return words.filter((w) => {
      if (topicFilter !== 'all' && w.topic !== topicFilter) return false
      if (learnedFilter === 'learned' && !w.learned) return false
      if (learnedFilter === 'unlearned' && w.learned) return false
      if (learnedFilter === 'missing' && w.meaning) return false
      if (!q) return true
      return (
        w.term?.toLowerCase().includes(q) ||
        w.meaning?.toLowerCase().includes(q) ||
        w.example?.toLowerCase().includes(q) ||
        w.exampleVi?.toLowerCase().includes(q) ||
        w.topic?.toLowerCase().includes(q)
      )
    })
  }, [words, query, topicFilter, learnedFilter])

  const duplicate = useMemo(() => {
    const norm = normalizeEntry(form.term)
    if (!norm) return null
    return words.find((w) => normalizeEntry(w.term) === norm && w.id !== editingId) || null
  }, [words, form.term, editingId])

  const persist = (next, message = '') => {
    setWords(next)
    setNotice(message)
    setSaveError('')
    putData('vocabulary', next).catch((e) => setSaveError(e.message || 'Lưu thất bại.'))
  }

  const resetForm = () => {
    setForm(EMPTY)
    setEditingId(null)
    setSaveError('')
    setNotice('')
  }

  const submit = () => {
    const term = form.term.trim()
    const meaning = form.meaning.trim()
    if (!term) { setSaveError('Cần nhập từ tiếng Anh.'); return }
    if (duplicate) { setSaveError(`Từ này đã có trong kho: ${duplicate.term}.`); return }
    const topic = form.topic.trim() || 'Khác'
    const example = form.example.trim()
    const exampleVi = form.exampleVi.trim()
    if (editingId) {
      persist(words.map((w) => (w.id === editingId ? { ...w, term, meaning, example, exampleVi, topic } : w)), 'Đã cập nhật từ.')
    } else {
      persist([...words, { id: makeId(term), term, meaning, example, exampleVi, topic, learned: false }], 'Đã thêm từ mới.')
    }
    resetForm()
  }

  const startEdit = (w) => {
    setEditingId(w.id)
    setForm({ term: w.term || '', meaning: w.meaning || '', example: w.example || '', exampleVi: w.exampleVi || '', topic: w.topic || '' })
    setConfirmId(null)
    setSaveError('')
    setNotice('')
  }

  const remove = (id) => {
    persist(words.filter((w) => w.id !== id), 'Đã xóa từ.')
    setConfirmId(null)
    if (editingId === id) resetForm()
  }

  const toggleLearned = (id) => {
    persist(words.map((w) => (w.id === id ? { ...w, learned: !w.learned } : w)), '')
  }

  const previewExtract = () => {
    const terms = collectEnglishTerms([{ en: extractText, vi: '' }])
      .sort((a, b) => (b.frequency || 0) - (a.frequency || 0) || a.term.localeCompare(b.term))
      .slice(0, Number(extractLimit) || 40)
    const fresh = newTermsAmong(words, terms)
    setExtractPreview(fresh)
    setNotice(fresh.length ? `Tìm thấy ${fresh.length} từ mới có thể thêm.` : 'Không tìm thấy từ mới. Có thể các từ đã nằm trong kho.')
    setSaveError('')
  }

  const addExtracted = async () => {
    const terms = extractPreview.length
      ? extractPreview
      : newTermsAmong(words, collectEnglishTerms([{ en: extractText, vi: '' }])).slice(0, Number(extractLimit) || 40)
    if (!terms.length) {
      setSaveError('Chưa có từ mới để thêm.')
      return
    }

    setExtractBusy(true)
    setSaveError('')
    setNotice('Đang thêm từ vào kho...')
    const defsByTerm = {}
    if (aiProvider) {
      try {
        const res = await defineVocabulary({ words: terms.map((t) => t.term), provider: aiProvider })
        const entries = Array.isArray(res?.entries) ? res.entries : []
        terms.forEach((t, i) => {
          const entry = entries[i]
          if (entry) defsByTerm[normalizeEntry(t.term)] = entry
        })
      } catch (err) {
        setSaveError((err?.message || 'AI không tạo được nghĩa/ví dụ.') + ' Đã thêm từ, bạn có thể bổ sung nghĩa sau.')
      }
    }

    const { next, added } = mergeVocabulary(words, terms, defsByTerm, extractTopic.trim() || 'Từ trích xuất')
    persist(next, `Đã thêm ${added} từ mới từ đoạn văn.`)
    setExtractPreview([])
    setExtractBusy(false)
  }

  return (
    <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="glow-accent break-words text-2xl font-bold tracking-[0.18em] sm:text-3xl">KHO TỪ VỰNG</h1>
            <p className="hud-label mt-2 flex items-center gap-2 text-dim">
              <span className="status-dot inline-block h-2 w-2 rounded-full bg-neon shadow-[0_0_8px_var(--color-neon)]" />
              THÊM, TRÍCH XUẤT VÀ ÔN LẠI VỐN TỪ
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat value={words.length} label="TỪ" />
            <Stat value={topics.length} label="CHỦ ĐỀ" />
            <Stat value={learnedCount} label="ĐÃ THUỘC" />
          </div>
        </header>

        {loadError && <div className="panel panel-accent px-4 py-3 text-sm text-accent">{loadError}</div>}
        {notice && <div className="panel px-4 py-3 text-sm text-neon">{notice}</div>}
        {saveError && <div className="panel panel-accent px-4 py-3 text-sm text-accent">{saveError}</div>}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <section className="panel hud-corners space-y-4 px-5 py-5">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <p className="hud-label text-accent/80">{editingId ? 'SỬA TỪ' : 'THÊM TỪ NHANH'}</p>
              {duplicate && <span className="text-xs text-accent">Đã có: {duplicate.term}</span>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="min-w-0 space-y-1">
                <span className="hud-label block text-dim">TỪ TIẾNG ANH</span>
                <input
                  value={form.term}
                  onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))}
                  placeholder="Ví dụ: efficient"
                  className="w-full bg-surface-2 border border-edge px-3 py-3 text-sm text-ink outline-none focus:border-neon"
                />
              </label>
              <label className="min-w-0 space-y-1">
                <span className="hud-label block text-dim">NGHĨA TIẾNG VIỆT</span>
                <input
                  value={form.meaning}
                  onChange={(e) => setForm((f) => ({ ...f, meaning: e.target.value }))}
                  placeholder="Ví dụ: hiệu quả"
                  className="w-full bg-surface-2 border border-edge px-3 py-3 text-sm text-ink outline-none focus:border-neon"
                />
              </label>
              <label className="min-w-0 space-y-1 sm:col-span-2">
                <span className="hud-label block text-dim">VÍ DỤ TIẾNG ANH</span>
                <textarea
                  value={form.example}
                  onChange={(e) => setForm((f) => ({ ...f, example: e.target.value }))}
                  placeholder="Câu ví dụ tiếng Anh"
                  rows={2}
                  className="w-full resize-y bg-surface-2 border border-edge px-3 py-3 text-sm text-ink outline-none focus:border-neon"
                />
              </label>
              <label className="min-w-0 space-y-1 sm:col-span-2">
                <span className="hud-label block text-dim">DỊCH CÂU VÍ DỤ</span>
                <textarea
                  value={form.exampleVi}
                  onChange={(e) => setForm((f) => ({ ...f, exampleVi: e.target.value }))}
                  placeholder="Bản dịch tiếng Việt của câu ví dụ"
                  rows={2}
                  className="w-full resize-y bg-surface-2 border border-edge px-3 py-3 text-sm text-ink outline-none focus:border-neon"
                />
              </label>
              <label className="min-w-0 space-y-1">
                <span className="hud-label block text-dim">CHỦ ĐỀ</span>
                <input
                  value={form.topic}
                  onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                  placeholder="Ví dụ: Công việc"
                  list="vocab-topics"
                  className="w-full bg-surface-2 border border-edge px-3 py-3 text-sm text-ink outline-none focus:border-neon"
                />
                <datalist id="vocab-topics">
                  {topics.map((t) => <option key={t} value={t} />)}
                </datalist>
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={submit}
                disabled={!form.term.trim() || Boolean(duplicate)}
                className="border border-neon/60 px-4 py-2 text-xs tracking-wider text-neon transition-colors hover:bg-neon/10 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {editingId ? 'CẬP NHẬT ▸' : 'THÊM TỪ ▸'}
              </button>
              {editingId && (
                <button onClick={resetForm} className="px-4 py-2 text-xs tracking-wider text-dim hover:text-ink">
                  HỦY SỬA
                </button>
              )}
            </div>
          </section>

          <section className="panel hud-corners space-y-4 px-5 py-5">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <p className="hud-label text-accent/80">TRÍCH TỪ TỪ ĐOẠN TIẾNG ANH</p>
              <span className="hud-label text-dim">LỌC TRÙNG TỰ ĐỘNG</span>
            </div>
            <textarea
              value={extractText}
              onChange={(e) => setExtractText(e.target.value)}
              placeholder="Dán đoạn tiếng Anh hoặc tài liệu ngắn. Công cụ sẽ rã từ, bỏ stopword, lọc từ đã có trong kho."
              rows={7}
              className="w-full resize-y bg-surface-2 border border-edge px-3 py-3 text-sm leading-relaxed text-ink outline-none focus:border-accent"
            />
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <input
                value={extractTopic}
                onChange={(e) => setExtractTopic(e.target.value)}
                placeholder="Chủ đề cho từ trích xuất"
                list="vocab-topics"
                className="w-full bg-surface-2 border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
              <select
                value={extractLimit}
                onChange={(e) => setExtractLimit(Number(e.target.value))}
                className="bg-surface-2 border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              >
                {[20, 40, 60, 100].map((n) => <option key={n} value={n}>{n} từ</option>)}
              </select>
              <select
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value)}
                className="bg-surface-2 border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              >
                <option value="">Không dùng AI</option>
                {providers.map((p) => (
                  <option key={p.name} value={p.name} disabled={!p.configured}>{p.name}{p.configured ? '' : ' (chưa cấu hình)'}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={previewExtract}
                disabled={!extractText.trim() || extractBusy}
                className="border border-edge px-4 py-2 text-xs tracking-wider text-dim transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
              >
                XEM TỪ MỚI
              </button>
              <button
                onClick={addExtracted}
                disabled={(!extractText.trim() && extractPreview.length === 0) || extractBusy}
                className="glow-accent border border-accent/60 px-4 py-2 text-xs tracking-wider text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {extractBusy ? 'ĐANG THÊM…' : 'THÊM TỪ ĐÃ TRÍCH ▸'}
              </button>
            </div>
            <div className="min-h-[4rem] border border-edge/70 px-3 py-3">
              {extractPreview.length ? (
                <div className="flex flex-wrap gap-2">
                  {extractPreview.map((t) => (
                    <span key={normalizeEntry(t.term)} className="border border-neon/30 px-2 py-1 text-xs text-neon/80">
                      {t.term} <span className="text-dim">×{t.frequency || 1}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-dim">Từ mới trích được sẽ hiện ở đây trước khi thêm vào kho.</p>
              )}
            </div>
          </section>
        </div>

        <section className="panel space-y-3 px-4 py-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm từ, nghĩa, ví dụ, chủ đề..."
              className="min-w-0 bg-surface-2 border border-edge px-3 py-3 text-sm text-ink outline-none focus:border-neon"
            />
            <select
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
              className="min-w-0 bg-surface-2 border border-edge px-3 py-3 text-sm text-ink outline-none focus:border-neon"
            >
              <option value="all">Tất cả chủ đề</option>
              {topics.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              value={learnedFilter}
              onChange={(e) => setLearnedFilter(e.target.value)}
              className="min-w-0 bg-surface-2 border border-edge px-3 py-3 text-sm text-ink outline-none focus:border-neon"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="unlearned">Chưa thuộc</option>
              <option value="learned">Đã thuộc</option>
              <option value="missing">Thiếu nghĩa ({missingMeaningCount})</option>
            </select>
            <span className="hud-label flex items-center text-dim">{filtered.length} / {words.length}</span>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.length === 0 ? (
            <div className="panel hud-corners px-5 py-8 text-center text-dim md:col-span-2 xl:col-span-3">
              {words.length === 0 ? 'Chưa có từ nào. Thêm từ đầu tiên ở trên.' : 'Không tìm thấy từ phù hợp.'}
            </div>
          ) : (
            filtered.map((w) => (
              <article key={w.id} className="panel flex min-h-[13rem] min-w-0 flex-col justify-between gap-4 px-4 py-4">
                <div className="min-w-0 space-y-2">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="break-words text-xl font-bold text-neon">{w.term}</span>
                        {w.learned && <span className="hud-label text-neon">ĐÃ THUỘC</span>}
                      </div>
                      <p className="mt-1 break-words text-sm text-ink">{w.meaning || 'Chưa có nghĩa tiếng Việt.'}</p>
                    </div>
                    <button onClick={() => speak(w.term)} className="shrink-0 text-dim hover:text-neon" title="Đọc to" aria-label="Đọc to">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {w.topic && <span className="border border-edge px-2 py-0.5 text-[10px] text-neon/70">{w.topic}</span>}
                    {w.frequency && <span className="border border-edge px-2 py-0.5 text-[10px] text-dim">TẦN SUẤT {w.frequency}</span>}
                    {w.auto && <span className="border border-edge px-2 py-0.5 text-[10px] text-dim">TRÍCH XUẤT</span>}
                  </div>
                  {w.example && (
                    <div className="space-y-1 text-sm leading-relaxed text-dim">
                      <p className="italic">“{w.example}”</p>
                      <p>{w.exampleVi || 'Chưa có bản dịch câu ví dụ.'}</p>
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-wrap gap-2 border-t border-edge/60 pt-3">
                  <button
                    onClick={() => toggleLearned(w.id)}
                    className="border border-edge px-2 py-1 text-[10px] tracking-wider text-dim transition-colors hover:text-neon"
                    title="Đánh dấu đã/chưa thuộc"
                  >
                    {w.learned ? 'CHƯA THUỘC' : 'ĐÃ THUỘC'}
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
              </article>
            ))
          )}
        </section>
      </div>
    </div>
  )
}

function Stat({ value, label }) {
  return (
    <div className="panel hud-corners min-w-[5.5rem] px-4 py-3 text-center">
      <div className="glow-neon text-2xl font-bold tabular-nums">{value}</div>
      <div className="hud-label text-dim">{label}</div>
    </div>
  )
}
