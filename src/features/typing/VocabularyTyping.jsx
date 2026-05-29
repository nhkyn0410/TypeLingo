import { useEffect, useMemo, useRef, useState } from 'react'
import { getData, putData } from '../../api/client'
import { speak } from '../../lib/util'
import { advanceTypingSession, canCheckWithSpace, selectTypingWords } from './typingLogic.js'

const COUNTS = [10, 20, 30, 'all']

function blankExample(example, term) {
  if (!example) return ''
  try {
    const re = new RegExp(`\\b${String(term).replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'ig')
    return example.replace(re, '_____')
  } catch {
    return example
  }
}

function initialSession(queue) {
  return {
    status: 'playing',
    queue,
    retryQueue: [],
    completedIds: [],
    attempts: 0,
    wrongAttempts: 0,
    round: 1,
    total: queue.length,
    startedAt: Date.now(),
    endedAt: null,
    last: null,
  }
}

export default function VocabularyTyping() {
  const [words, setWords] = useState([])
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [topic, setTopic] = useState('all')
  const [onlyUnlearned, setOnlyUnlearned] = useState(false)
  const [count, setCount] = useState(20)
  const [session, setSession] = useState(null)
  const [input, setInput] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    getData('vocabulary')
      .then((d) => setWords(Array.isArray(d) ? d : []))
      .catch((e) => setLoadError(e.message || 'Không tải được từ vựng.'))
  }, [])

  useEffect(() => {
    if (session?.status === 'playing') inputRef.current?.focus()
  }, [session?.queue?.[0]?.id, session?.status])

  const topics = useMemo(() => Array.from(new Set(words.map((w) => w.topic).filter(Boolean))), [words])
  const pool = useMemo(
    () => selectTypingWords(words, { topic, onlyUnlearned, count: 'all' }),
    [words, topic, onlyUnlearned],
  )

  const current = session?.queue?.[0] || null
  const progress = session ? Math.round((session.completedIds.length / Math.max(1, session.total)) * 100) : 0
  const pendingInRound = session?.queue?.length || 0
  const retryLater = session?.retryQueue?.length || 0
  const elapsedSeconds = session?.startedAt
    ? Math.max(1, Math.round(((session.endedAt || Date.now()) - session.startedAt) / 1000))
    : 0
  const accuracy = session?.attempts ? Math.round((session.completedIds.length / session.attempts) * 100) : 100

  const start = () => {
    const queue = selectTypingWords(words, { topic, onlyUnlearned, count })
    if (!queue.length) return
    setSession(initialSession(queue))
    setInput('')
    setSaveError('')
  }

  const submit = () => {
    if (!session || session.status !== 'playing' || !current || !input.trim()) return
    const next = advanceTypingSession(session, input)
    setSession(next.status === 'done' ? { ...next, endedAt: Date.now() } : next)
    setInput('')
  }

  const restart = () => {
    setSession(null)
    setInput('')
    setSaveError('')
  }

  const markCompletedLearned = () => {
    if (!session?.completedIds?.length) return
    const done = new Set(session.completedIds)
    const next = words.map((word) => (done.has(word.id) ? { ...word, learned: true } : word))
    setWords(next)
    putData('vocabulary', next)
      .then(() => setSaveError('Đã đánh dấu các từ trong bài là đã thuộc.'))
      .catch((e) => setSaveError(e.message || 'Không lưu được trạng thái đã thuộc.'))
  }

  const spaceChecks = current ? canCheckWithSpace(current) : true
  const canSubmit = Boolean(input.trim())

  return (
    <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto w-full max-w-4xl min-w-0 space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="glow-accent break-words text-2xl font-bold tracking-[0.18em] sm:text-3xl">GÕ TỪ VỰNG</h1>
            <p className="hud-label mt-2 flex items-center gap-2 text-dim">
              <span className="status-dot inline-block h-2 w-2 rounded-full bg-neon shadow-[0_0_8px_var(--color-neon)]" />
              GÕ TỪ TIẾNG ANH THEO NGHĨA
            </p>
          </div>
          <div className="panel hud-corners flex items-baseline gap-2 px-5 py-3">
            <span className="glow-neon text-2xl font-bold tabular-nums">{pool.length}</span>
            <span className="hud-label text-dim">TỪ SẴN SÀNG</span>
          </div>
        </header>

        {loadError && <div className="panel panel-accent px-4 py-3 text-sm text-accent">{loadError}</div>}

        {!session && (
          <div className="panel hud-corners space-y-5 px-5 py-6">
            <p className="hud-label text-accent/80">THIẾT LẬP BÀI GÕ</p>

            <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
              <label className="min-w-0 space-y-2">
                <span className="hud-label block text-dim">CHỦ ĐỀ</span>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full bg-surface-2 border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-neon"
                >
                  <option value="all">Tất cả ({words.filter((w) => w.term && w.meaning).length})</option>
                  {topics.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>

              <label className="min-w-0 space-y-2">
                <span className="hud-label block text-dim">SỐ TỪ</span>
                <select
                  value={count}
                  onChange={(e) => setCount(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="w-full bg-surface-2 border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-neon"
                >
                  {COUNTS.map((n) => (
                    <option key={n} value={n}>{n === 'all' ? 'Tất cả' : n}</option>
                  ))}
                </select>
              </label>

              <label className="flex items-end gap-2 pb-2 text-sm text-dim">
                <input
                  type="checkbox"
                  checked={onlyUnlearned}
                  onChange={(e) => setOnlyUnlearned(e.target.checked)}
                  className="h-4 w-4 accent-[var(--color-neon)]"
                />
                Chỉ từ chưa thuộc
              </label>
            </div>

            <div className="panel px-4 py-3 text-sm leading-relaxed text-dim">
              Mỗi từ xuất hiện một lần trong mỗi vòng. Nếu gõ sai, từ đó sẽ quay lại sau khi bạn đi hết các từ còn lại.
            </div>

            <button
              onClick={start}
              disabled={pool.length < 1}
              className="glow-neon border border-neon/60 px-6 py-2 text-sm tracking-wider text-neon transition-colors hover:bg-neon/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              BẮT ĐẦU GÕ ▸
            </button>
          </div>
        )}

        {session?.status === 'playing' && current && (
          <div className="space-y-5">
            <div className="panel flex min-w-0 flex-wrap items-center gap-4 px-4 py-3">
              <div className="min-w-[9rem] flex-1">
                <div className="h-2 w-full bg-surface-2">
                  <div className="h-full bg-gradient-to-r from-neon to-accent transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <span className="hud-label text-dim">ĐÚNG {session.completedIds.length} / {session.total}</span>
              <span className="hud-label text-dim">VÒNG {session.round}</span>
              <span className="hud-label text-accent/80">CHỜ SỬA {retryLater}</span>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="panel hud-corners flex min-h-[22rem] min-w-0 flex-col justify-between gap-6 px-5 py-6 sm:px-6">
                <div className="space-y-4">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                    <p className="hud-label text-neon/70">NHẬP TỪ TIẾNG ANH</p>
                    <span className="border border-edge px-2 py-1 text-[10px] text-neon/70">{current.topic || 'Không chủ đề'}</span>
                  </div>
                  <div className="text-center">
                    <p className="break-words text-3xl font-bold leading-tight text-ink sm:text-4xl">{current.meaning}</p>
                  </div>
                  {current.example && (
                    <div className="mx-auto max-w-2xl space-y-2 text-center text-sm leading-relaxed text-dim">
                      <p className="italic">“{blankExample(current.example, current.term)}”</p>
                      {current.exampleVi && <p>{current.exampleVi}</p>}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.key === ' ' && spaceChecks) || e.key === 'Enter') {
                        e.preventDefault()
                        submit()
                      }
                    }}
                    autoFocus
                    spellCheck="false"
                    placeholder={spaceChecks ? 'Gõ từ rồi nhấn Space...' : 'Gõ cụm từ rồi nhấn Enter...'}
                    className="w-full bg-surface-2 border border-edge px-4 py-4 text-center text-xl text-ink outline-none transition-colors focus:border-neon"
                  />
                  <div className="flex min-h-9 flex-wrap items-center justify-between gap-3 text-xs text-dim">
                    <span>{spaceChecks ? 'Space để kiểm tra' : 'Cụm từ dùng Enter để kiểm tra'}</span>
                    <button
                      onClick={submit}
                      disabled={!canSubmit}
                      className="border border-neon/60 px-4 py-2 tracking-wider text-neon transition-colors hover:bg-neon/10 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      KIỂM TRA ▸
                    </button>
                  </div>
                </div>
              </div>

              <aside className="panel hud-corners min-h-[22rem] min-w-0 space-y-4 px-5 py-6">
                <p className="hud-label text-accent/80">TRẠNG THÁI</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="panel px-3 py-3">
                    <div className="glow-neon text-2xl font-bold tabular-nums">{pendingInRound}</div>
                    <div className="hud-label text-dim">CÒN TRONG VÒNG</div>
                  </div>
                  <div className="panel px-3 py-3">
                    <div className="glow-accent text-2xl font-bold tabular-nums">{session.wrongAttempts}</div>
                    <div className="hud-label text-dim">LẦN SAI</div>
                  </div>
                </div>

                <div className="min-h-[8rem] border border-edge/70 px-4 py-4">
                  {session.last ? (
                    <div className="space-y-2 text-sm">
                      <p className={session.last.correct ? 'glow-neon font-bold' : 'glow-accent font-bold'}>
                        {session.last.correct ? 'ĐÚNG' : 'SAI, TỪ NÀY SẼ QUAY LẠI CUỐI VÒNG'}
                      </p>
                      <p className="break-words text-dim">Bạn gõ: <span className="text-ink">{session.last.input || '—'}</span></p>
                      <p className="break-words text-dim">Từ đúng: <span className="text-neon">{session.last.word.term}</span></p>
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed text-dim">Bắt đầu bằng từ đầu tiên. Phản hồi sẽ nằm ở đây để giao diện không bị nhảy khi bạn gõ.</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button onClick={() => speak(current.term)} className="border border-edge px-3 py-2 text-xs tracking-wider text-dim hover:text-neon">
                    ĐỌC TỪ
                  </button>
                  <button onClick={restart} className="border border-edge px-3 py-2 text-xs tracking-wider text-dim hover:text-ink">
                    LÀM LẠI
                  </button>
                </div>
              </aside>
            </div>
          </div>
        )}

        {session?.status === 'done' && (
          <div className="space-y-5">
            <div className="panel panel-accent hud-corners px-5 py-8 text-center">
              <div className="glow-accent text-5xl font-bold tabular-nums sm:text-6xl">HOÀN THÀNH</div>
              <p className="hud-label mt-3 text-dim">ĐÃ GÕ ĐÚNG {session.total} / {session.total} TỪ</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="panel px-4 py-4 text-center">
                <div className="glow-neon text-3xl font-bold tabular-nums">{session.attempts}</div>
                <div className="hud-label text-dim">LƯỢT GÕ</div>
              </div>
              <div className="panel px-4 py-4 text-center">
                <div className="glow-neon text-3xl font-bold tabular-nums">{accuracy}%</div>
                <div className="hud-label text-dim">ĐỘ CHÍNH XÁC</div>
              </div>
              <div className="panel px-4 py-4 text-center">
                <div className="glow-neon text-3xl font-bold tabular-nums">{elapsedSeconds}s</div>
                <div className="hud-label text-dim">THỜI GIAN</div>
              </div>
            </div>

            {saveError && <div className="panel px-4 py-3 text-sm text-neon">{saveError}</div>}

            <div className="flex flex-wrap gap-3">
              <button onClick={restart} className="border border-neon/60 px-5 py-2 text-sm tracking-wider text-neon transition-colors hover:bg-neon/10">
                LÀM BÀI MỚI ▸
              </button>
              <button onClick={markCompletedLearned} className="border border-edge px-5 py-2 text-sm tracking-wider text-dim transition-colors hover:text-neon">
                ĐÁNH DẤU ĐÃ THUỘC
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
