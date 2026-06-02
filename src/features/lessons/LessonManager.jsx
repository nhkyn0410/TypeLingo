import { useEffect, useMemo, useState } from 'react'
import { getData, putData } from '../../api/client'
import { makeId } from '../../lib/util'

function prettyPairs(pairs) {
  return JSON.stringify(Array.isArray(pairs) ? pairs : [], null, 2)
}

function validPairsFromText(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('JSON không hợp lệ.')
  }
  if (!Array.isArray(parsed)) throw new Error('Nội dung phải là một mảng các cặp câu.')
  const pairs = parsed.map((pair, index) => {
    const en = String(pair?.en || '').trim()
    const vi = String(pair?.vi || '').trim()
    if (!en || !vi) throw new Error(`Cặp câu ${index + 1} cần có cả en và vi.`)
    return { en, vi }
  })
  if (!pairs.length) throw new Error('Bài cần có ít nhất một cặp câu.')
  return pairs
}

export default function LessonManager() {
  const [lessons, setLessons] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [query, setQuery] = useState('')
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [pairsDraft, setPairsDraft] = useState('[]')

  useEffect(() => {
    getData('exercises')
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        setLessons(list)
        if (list.length) setSelectedId(list[0].id)
      })
      .catch((err) => setLoadError(err.message || 'Không tải được danh sách bài.'))
  }, [])

  const selected = useMemo(() => lessons.find((lesson) => lesson.id === selectedId) || null, [lessons, selectedId])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return lessons
    return lessons.filter((lesson) => {
      const text = [lesson.title, ...(lesson.pairs || []).flatMap((pair) => [pair.en, pair.vi])].join(' ').toLowerCase()
      return text.includes(q)
    })
  }, [lessons, query])

  useEffect(() => {
    if (!selected) {
      setTitleDraft('')
      setPairsDraft('[]')
      setConfirmDelete(false)
      return
    }
    setTitleDraft(selected.title || '')
    setPairsDraft(prettyPairs(selected.pairs))
    setConfirmDelete(false)
    setSaveError('')
    setNotice('')
  }, [selectedId, selected])

  const persist = (next, message) => {
    setLessons(next)
    setNotice(message || '')
    setSaveError('')
    putData('exercises', next).catch((err) => setSaveError(err.message || 'Lưu danh sách bài thất bại.'))
  }

  const saveSelected = () => {
    if (!selected) return
    const title = titleDraft.trim()
    if (!title) {
      setSaveError('Cần nhập tiêu đề bài.')
      return
    }
    try {
      const pairs = validPairsFromText(pairsDraft)
      const next = lessons.map((lesson) => (lesson.id === selected.id ? { ...lesson, title, pairs } : lesson))
      persist(next, 'Đã lưu bài.')
    } catch (err) {
      setSaveError(err.message || 'Không lưu được bài.')
    }
  }

  const duplicateSelected = () => {
    if (!selected) return
    const copyTitle = `${selected.title || 'Bài học'} (bản sao)`
    const created = { id: makeId(copyTitle), title: copyTitle, pairs: selected.pairs || [] }
    const next = [...lessons, created]
    persist(next, 'Đã nhân bản bài.')
    setSelectedId(created.id)
  }

  const deleteSelected = () => {
    if (!selected) return
    const next = lessons.filter((lesson) => lesson.id !== selected.id)
    persist(next, 'Đã xóa bài.')
    setSelectedId(next[0]?.id || '')
    setConfirmDelete(false)
  }

  const totalPairs = lessons.reduce((sum, lesson) => sum + (lesson.pairs?.length || 0), 0)

  return (
    <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="glow-accent break-words text-2xl font-bold tracking-[0.18em] sm:text-3xl">QUẢN LÝ BÀI</h1>
            <p className="hud-label mt-2 flex items-center gap-2 text-dim">
              <span className="status-dot inline-block h-2 w-2 rounded-full bg-neon shadow-[0_0_8px_var(--color-neon)]" />
              XEM, SỬA, NHÂN BẢN VÀ XÓA BÀI LUYỆN
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat value={lessons.length} label="BÀI" />
            <Stat value={totalPairs} label="CÂU" />
          </div>
        </header>

        {loadError && <div className="panel panel-accent px-4 py-3 text-sm text-accent">{loadError}</div>}
        {notice && <div className="panel px-4 py-3 text-sm text-neon">{notice}</div>}
        {saveError && <div className="panel panel-accent px-4 py-3 text-sm text-accent">{saveError}</div>}

        <div className="grid gap-5 lg:grid-cols-[minmax(18rem,0.9fr)_minmax(0,1.4fr)]">
          <aside className="panel hud-corners min-w-0 space-y-4 px-5 py-5">
            <p className="hud-label text-accent/80">DANH SÁCH BÀI</p>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tiêu đề hoặc nội dung..."
              className="w-full bg-surface-2 border border-edge px-3 py-3 text-sm text-ink outline-none focus:border-neon"
            />
            <div className="max-h-[36rem] space-y-2 overflow-y-auto pr-1">
              {filtered.length === 0 ? (
                <div className="border border-edge/70 px-4 py-8 text-center text-sm text-dim">
                  {lessons.length === 0 ? 'Chưa có bài nào. Tạo bài từ tab DỊCH.' : 'Không tìm thấy bài phù hợp.'}
                </div>
              ) : (
                filtered.map((lesson) => (
                  <button
                    key={lesson.id}
                    onClick={() => setSelectedId(lesson.id)}
                    className={`w-full border px-4 py-3 text-left transition-colors ${
                      selectedId === lesson.id ? 'border-neon bg-neon/10 text-ink' : 'border-edge text-dim hover:text-ink'
                    }`}
                  >
                    <span className="block truncate text-sm font-bold text-neon">{lesson.title || 'Chưa có tiêu đề'}</span>
                    <span className="hud-label mt-1 block text-dim">{lesson.pairs?.length || 0} CÂU</span>
                  </button>
                ))
              )}
            </div>
          </aside>

          <main className="panel hud-corners min-w-0 space-y-4 px-5 py-5">
            {selected ? (
              <>
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                  <p className="hud-label text-accent/80">CHI TIẾT BÀI</p>
                  <span className="hud-label text-dim">{selected.pairs?.length || 0} CÂU</span>
                </div>

                <label className="block min-w-0 space-y-2">
                  <span className="hud-label block text-dim">TIÊU ĐỀ</span>
                  <input
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    className="w-full bg-surface-2 border border-edge px-3 py-3 text-sm text-ink outline-none focus:border-neon"
                  />
                </label>

                <label className="block min-w-0 space-y-2">
                  <span className="hud-label block text-dim">CẶP CÂU JSON</span>
                  <textarea
                    value={pairsDraft}
                    onChange={(e) => setPairsDraft(e.target.value)}
                    rows={14}
                    spellCheck="false"
                    className="w-full resize-y bg-surface-2 border border-edge px-3 py-3 font-mono text-sm leading-relaxed text-ink outline-none focus:border-neon"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  {(selected.pairs || []).slice(0, 4).map((pair, index) => (
                    <div key={index} className="border border-edge/70 px-3 py-3 text-sm leading-relaxed">
                      <p className="hud-label mb-2 text-dim">CÂU {index + 1}</p>
                      <p className="break-words text-ink">{pair.en}</p>
                      <p className="mt-2 break-words text-dim">{pair.vi}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3 border-t border-edge/60 pt-4">
                  <button
                    onClick={saveSelected}
                    className="border border-neon/60 px-4 py-2 text-xs tracking-wider text-neon transition-colors hover:bg-neon/10"
                  >
                    LƯU THAY ĐỔI ▸
                  </button>
                  <button
                    onClick={duplicateSelected}
                    className="border border-edge px-4 py-2 text-xs tracking-wider text-dim transition-colors hover:text-ink"
                  >
                    NHÂN BẢN
                  </button>
                  {confirmDelete ? (
                    <button
                      onClick={deleteSelected}
                      className="border border-accent bg-accent/15 px-4 py-2 text-xs tracking-wider text-accent glow-accent"
                    >
                      XÓA VĨNH VIỄN?
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="border border-edge px-4 py-2 text-xs tracking-wider text-dim transition-colors hover:text-accent"
                    >
                      XÓA BÀI
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="flex min-h-[24rem] items-center justify-center px-4 text-center text-sm leading-relaxed text-dim">
                Chọn một bài ở danh sách bên trái để xem và chỉnh sửa.
              </div>
            )}
          </main>
        </div>
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
