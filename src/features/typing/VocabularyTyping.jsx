import { useEffect, useMemo, useRef, useState } from 'react'
import { getData, putData } from '../../api/client'
import { speak } from '../../lib/util'
import { advanceTypingSession, canCheckWithSpace, isTypingAnswerCorrect, selectTypingWords } from './typingLogic.js'

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

function initialSession(queue, mode) {
  return {
    status: 'playing',
    mode,
    queue,
    retryQueue: [],
    completedIds: [],
    practicedIds: [],
    attempts: 0,
    wrongAttempts: 0,
    round: 1,
    total: queue.length,
    startedAt: Date.now(),
    endedAt: null,
    last: null,
  }
}

function typedPreview(term, input) {
  const target = String(term || '')
  const typed = String(input || '')
  const out = []
  for (let i = 0; i < target.length; i++) {
    const expected = target[i]
    const actual = typed[i]
    const ok = actual == null || actual.toLowerCase() === expected.toLowerCase()
    out.push({ char: expected, typed: actual != null, ok })
  }
  return out
}

export default function VocabularyTyping() {
  const [words, setWords] = useState([])
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [topic, setTopic] = useState('all')
  const [onlyUnlearned, setOnlyUnlearned] = useState(false)
  const [count, setCount] = useState(20)
  const [mode, setMode] = useState('practice')
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
  const doneCount = session ? session.completedIds.length : 0
  const progress = session ? Math.round((doneCount / Math.max(1, session.total)) * 100) : 0
  const pendingInRound = session?.queue?.length || 0
  const retryLater = session?.retryQueue?.length || 0
  const elapsedSeconds = session?.startedAt
    ? Math.max(1, Math.round(((session.endedAt || Date.now()) - session.startedAt) / 1000))
    : 0
  const accuracy = session?.attempts ? Math.round((session.completedIds.length / session.attempts) * 100) : 100
  const preview = current ? typedPreview(current.term, input) : []
  const liveMismatch = Boolean(current && input && !String(current.term).toLowerCase().startsWith(input.toLowerCase()))

  const start = () => {
    const queue = selectTypingWords(words, { topic, onlyUnlearned, count })
    if (!queue.length) return
    setSession(initialSession(queue, mode))
    setInput('')
    setSaveError('')
  }

  const submitPractice = () => {
    if (!session || !current || !input.trim()) return
    const correct = isTypingAnswerCorrect(current, input)
    const attempts = session.attempts + 1
    const wrongAttempts = correct ? session.wrongAttempts : session.wrongAttempts + 1
    const last = {
      word: current,
      input: String(input || '').trim(),
      correct,
      round: session.round,
      practice: true,
    }
    if (!correct) {
      setSession({ ...session, attempts, wrongAttempts, last })
      setInput('')
      return
    }
    const remaining = session.queue.slice(1)
    const completedIds = [...session.completedIds, current.id]
    const practicedIds = [...session.practicedIds, current.id]
    const next = {
      ...session,
      queue: remaining,
      completedIds,
      practicedIds,
      attempts,
      wrongAttempts,
      last,
      status: remaining.length ? 'playing' : 'done',
    }
    setSession(next.status === 'done' ? { ...next, endedAt: Date.now() } : next)
    setInput('')
  }

  const submitTest = () => {
    if (!session || session.status !== 'playing' || !current || !input.trim()) return
    const next = advanceTypingSession(session, input)
    setSession(next.status === 'done' ? { ...next, endedAt: Date.now() } : next)
    setInput('')
  }

  const submit = () => {
    if (session?.mode === 'practice') submitPractice()
    else submitTest()
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
  const isPractice = session?.mode === 'practice'

  return (
    <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto w-full max-w-5xl min-w-0 space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="glow-accent break-words text-2xl font-bold tracking-[0.18em] sm:text-3xl">GÕ TỪ VỰNG</h1>
            <p className="hud-label mt-2 flex items-center gap-2 text-dim">
              <span className="status-dot inline-block h-2 w-2 rounded-full bg-neon shadow-[0_0_8px_var(--color-neon)]" />
              LUYỆN GÕ VÀ KIỂM TRA TRÍ NHỚ TỪ
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

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => setMode('practice')}
                className={`border px-4 py-4 text-left transition-colors ${mode === 'practice' ? 'border-neon bg-neon/10 text-ink' : 'border-edge text-dim hover:text-ink'}`}
              >
                <span className="hud-label block text-neon/80">LUYỆN TẬP</span>
                <span className="mt-2 block text-sm leading-relaxed">Hiện từ mẫu, tô tiến độ từng ký tự. Gõ sai sẽ ở lại từ hiện tại để sửa ngay.</span>
              </button>
              <button
                onClick={() => setMode('test')}
                className={`border px-4 py-4 text-left transition-colors ${mode === 'test' ? 'border-accent bg-accent/10 text-ink' : 'border-edge text-dim hover:text-ink'}`}
              >
                <span className="hud-label block text-accent/80">KIỂM TRA</span>
                <span className="mt-2 block text-sm leading-relaxed">Ẩn đáp án. Nếu sai, từ đó quay lại sau khi đi hết các từ còn lại.</span>
              </button>
            </div>

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

            <button
              onClick={start}
              disabled={pool.length < 1}
              className="glow-neon border border-neon/60 px-6 py-2 text-sm tracking-wider text-neon transition-colors hover:bg-neon/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {mode === 'practice' ? 'BẮT ĐẦU LUYỆN ▸' : 'BẮT ĐẦU KIỂM TRA ▸'}
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
              <span className="hud-label text-dim">{isPractice ? 'ĐÃ LUYỆN' : 'ĐÚNG'} {doneCount} / {session.total}</span>
              <span className="hud-label text-dim">{isPractice ? 'LUYỆN TẬP' : `VÒNG ${session.round}`}</span>
              {!isPractice && <span className="hud-label text-accent/80">CHỜ SỬA {retryLater}</span>}
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="panel hud-corners flex min-h-[25rem] min-w-0 flex-col justify-between gap-6 px-5 py-6 sm:px-6">
                <div className="space-y-4">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                    <p className="hud-label text-neon/70">{isPractice ? 'LUYỆN GÕ THEO MẪU' : 'NHẬP TỪ TIẾNG ANH'}</p>
                    <span className="border border-edge px-2 py-1 text-[10px] text-neon/70">{current.topic || 'Không chủ đề'}</span>
                  </div>
                  <div className="text-center">
                    <p className="break-words text-3xl font-bold leading-tight text-ink sm:text-4xl">{current.meaning}</p>
                  </div>
                  {isPractice && (
                    <div className="space-y-2 text-center">
                      <div className="flex min-w-0 flex-wrap justify-center gap-1 font-mono text-3xl font-bold sm:text-4xl">
                        {preview.map((p, i) => (
                          <span
                            key={`${p.char}-${i}`}
                            className={p.typed ? (p.ok ? 'text-neon glow-neon' : 'bg-red-500/20 text-red-300') : 'text-dim/45'}
                          >
                            {p.char === ' ' ? '·' : p.char}
                          </span>
                        ))}
                      </div>
                      <p className="text-sm text-dim">Nhìn từ mẫu, gõ lại đúng chính tả. Sai ký tự sẽ được tô đỏ ngay.</p>
                    </div>
                  )}
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
                    className={`w-full bg-surface-2 border px-4 py-4 text-center text-xl text-ink outline-none transition-colors ${liveMismatch && isPractice ? 'border-red-400/80' : 'border-edge focus:border-neon'}`}
                  />
                  <div className="flex min-h-9 flex-wrap items-center justify-between gap-3 text-xs text-dim">
                    <span>{spaceChecks ? 'Space để kiểm tra' : 'Cụm từ dùng Enter để kiểm tra'}</span>
                    <button
                      onClick={submit}
                      disabled={!canSubmit}
                      className="border border-neon/60 px-4 py-2 tracking-wider text-neon transition-colors hover:bg-neon/10 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      {isPractice ? 'XONG TỪ NÀY ▸' : 'KIỂM TRA ▸'}
                    </button>
                  </div>
                </div>
              </div>

              <aside className="panel hud-corners min-h-[25rem] min-w-0 space-y-4 px-5 py-6">
                <p className="hud-label text-accent/80">TRẠNG THÁI</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="panel px-3 py-3">
                    <div className="glow-neon text-2xl font-bold tabular-nums">{pendingInRound}</div>
                    <div className="hud-label text-dim">CÒN LẠI</div>
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
                        {session.last.correct ? 'ĐÚNG' : isPractice ? 'CHƯA ĐÚNG, GÕ LẠI TỪ NÀY' : 'SAI, TỪ NÀY SẼ QUAY LẠI CUỐI VÒNG'}
                      </p>
                      <p className="break-words text-dim">Bạn gõ: <span className="text-ink">{session.last.input || '—'}</span></p>
                      <p className="break-words text-dim">Từ đúng: <span className="text-neon">{session.last.word.term}</span></p>
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed text-dim">
                      {isPractice ? 'Chế độ luyện tập hiện đáp án để bạn hình thành cơ nhớ phím trước khi kiểm tra.' : 'Bắt đầu bằng từ đầu tiên. Phản hồi sẽ nằm ở đây để giao diện không bị nhảy khi bạn gõ.'}
                    </p>
                  )}
                </div>

                <div className="space-y-2 border border-edge/70 px-4 py-4 text-sm text-dim">
                  <p className="hud-label text-dim">THẺ NHỚ NHANH</p>
                  <p className="break-words text-ink">{current.term}</p>
                  <p className="break-words">{current.meaning}</p>
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
              <p className="hud-label mt-3 text-dim">{session.mode === 'practice' ? 'ĐÃ LUYỆN ĐÚNG' : 'ĐÃ GÕ ĐÚNG'} {session.total} / {session.total} TỪ</p>
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
