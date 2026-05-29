import { useEffect, useMemo, useState } from 'react'
import { getData } from '../../api/client'
import { shuffle, normalize, speak } from '../../lib/util'

// ----- Sinh câu hỏi từ vốn từ vựng -----
function buildMC(word, pool) {
  const others = shuffle(pool.filter((w) => w.id !== word.id)).slice(0, 3)
  const options = shuffle([word.meaning, ...others.map((o) => o.meaning)])
  return { type: 'mc', key: `mc-${word.id}`, prompt: word.term, answer: word.meaning, options, topic: word.topic }
}
function buildFill(word) {
  return { type: 'fill', key: `fill-${word.id}`, prompt: word.meaning, answer: word.term, example: word.example, topic: word.topic }
}
function buildMatch(words4) {
  const pairs = words4.map((w) => ({ term: w.term, meaning: w.meaning }))
  return { type: 'match', key: `match-${words4.map((w) => w.id).join('-')}`, pairs, options: shuffle(pairs.map((p) => p.meaning)) }
}

export function generateQuiz(words, count) {
  const usable = words.filter((w) => w.term && w.meaning)
  const canMC = usable.length >= 4
  const questions = []
  if (canMC) questions.push(buildMatch(shuffle(usable).slice(0, 4)))
  const pool = shuffle(usable)
  for (let i = 0; i < count && pool.length; i++) {
    const w = pool[i % pool.length]
    if (i % 2 === 0 && canMC) questions.push(buildMC(w, usable))
    else questions.push(buildFill(w))
  }
  return questions
}

// Thay từ cần điền trong câu ví dụ bằng chỗ trống.
function blankExample(example, term) {
  if (!example) return ''
  try {
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'ig')
    return example.replace(re, '_____')
  } catch {
    return example
  }
}

export default function Quiz() {
  const [words, setWords] = useState([])
  const [loadError, setLoadError] = useState('')
  const [topic, setTopic] = useState('all')
  const [count, setCount] = useState(6)
  const [stage, setStage] = useState('config') // config | playing | result
  const [questions, setQuestions] = useState([])
  const [qIndex, setQIndex] = useState(0)
  const [responses, setResponses] = useState([])

  // Trạng thái câu trả lời hiện tại
  const [mcChoice, setMcChoice] = useState(null)
  const [fillText, setFillText] = useState('')
  const [matchSel, setMatchSel] = useState({})

  useEffect(() => {
    getData('vocabulary')
      .then((d) => setWords(Array.isArray(d) ? d : []))
      .catch((e) => setLoadError(e.message || 'Không tải được từ vựng.'))
  }, [])

  const topics = useMemo(() => Array.from(new Set(words.map((w) => w.topic).filter(Boolean))), [words])
  const pool = useMemo(
    () => (topic === 'all' ? words : words.filter((w) => w.topic === topic)).filter((w) => w.term && w.meaning),
    [words, topic],
  )

  const resetAnswer = () => { setMcChoice(null); setFillText(''); setMatchSel({}) }

  const start = () => {
    const qs = generateQuiz(pool, Number(count) || 6)
    setQuestions(qs)
    setQIndex(0)
    setResponses([])
    resetAnswer()
    setStage('playing')
  }

  const current = questions[qIndex] || null

  const answered = current
    ? current.type === 'mc'
      ? mcChoice != null
      : current.type === 'fill'
        ? fillText.trim().length > 0
        : current.pairs.every((p) => matchSel[p.term])
    : false

  const submit = () => {
    if (!current) return
    let correct = false
    let given = null
    if (current.type === 'mc') {
      given = mcChoice
      correct = mcChoice === current.answer
    } else if (current.type === 'fill') {
      given = fillText
      correct = normalize(fillText) === normalize(current.answer)
    } else {
      given = { ...matchSel }
      correct = current.pairs.every((p) => matchSel[p.term] === p.meaning)
    }
    const next = [...responses, { question: current, correct, given }]
    setResponses(next)
    if (qIndex < questions.length - 1) {
      setQIndex(qIndex + 1)
      resetAnswer()
    } else {
      setStage('result')
    }
  }

  const score = responses.filter((r) => r.correct).length
  const wrong = responses.filter((r) => !r.correct)
  const scorePct = responses.length ? Math.round((score / responses.length) * 100) : 0

  return (
    <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto w-full max-w-3xl min-w-0 space-y-6">
        {/* HEADER */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="glow-accent text-2xl font-bold tracking-[0.18em] sm:text-3xl">KIỂM TRA NHANH</h1>
            <p className="hud-label mt-2 flex items-center gap-2 text-dim">
              <span className="status-dot inline-block h-2 w-2 rounded-full bg-neon shadow-[0_0_8px_var(--color-neon)]" />
              THỬ THÁCH TRÍ NHỚ TỪ VỰNG
            </p>
          </div>
          {stage === 'playing' && (
            <div className="panel hud-corners flex items-baseline gap-2 px-5 py-3">
              <span className="glow-neon text-2xl font-bold tabular-nums">{qIndex + 1}</span>
              <span className="hud-label text-dim">/ {questions.length}</span>
            </div>
          )}
        </header>

        {loadError && <div className="panel panel-accent px-4 py-3 text-sm text-accent">{loadError}</div>}

        {/* CONFIG */}
        {stage === 'config' && (
          <div className="panel hud-corners space-y-5 px-5 py-6">
            <p className="hud-label text-accent/80">THIẾT LẬP BÀI KIỂM TRA</p>

            <div className="flex min-w-0 flex-wrap items-center gap-4">
              <label className="hud-label text-dim">CHỦ ĐỀ</label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="min-w-[10rem] flex-1 bg-surface-2 border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-neon sm:flex-none"
              >
                <option value="all">Tất cả ({words.length})</option>
                {topics.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              <label className="hud-label text-dim">SỐ CÂU</label>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="bg-surface-2 border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-neon"
              >
                {[4, 6, 8, 10].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <p className="text-sm text-dim">
              Có <span className="text-neon">{pool.length}</span> từ trong phạm vi đã chọn.
              {pool.length < 4 && ' (Cần ≥ 4 từ để có câu trắc nghiệm & ghép cặp.)'}
            </p>

            <button
              onClick={start}
              disabled={pool.length < 1}
              className="glow-neon border border-neon/60 px-6 py-2 text-sm tracking-wider text-neon transition-colors hover:bg-neon/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              BẮT ĐẦU ▸
            </button>
          </div>
        )}

        {/* PLAYING */}
        {stage === 'playing' && current && (
          <div className="space-y-5">
            <div className="h-1 w-full bg-surface-2">
              <div
                className="h-full bg-gradient-to-r from-neon to-accent transition-all duration-300"
                style={{ width: `${Math.round((qIndex / questions.length) * 100)}%` }}
              />
            </div>

            <div className="panel hud-corners space-y-5 px-5 py-6">
              {/* MC */}
              {current.type === 'mc' && (
                <>
                  <p className="hud-label text-neon/70">CHỌN NGHĨA ĐÚNG</p>
                  <div className="flex min-w-0 flex-wrap items-center justify-center gap-3">
                    <span className="glow-neon min-w-0 break-words text-3xl font-bold sm:text-4xl">{current.prompt}</span>
                    <button onClick={() => speak(current.prompt)} className="text-dim hover:text-neon" title="Đọc to" aria-label="Đọc to">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                      </svg>
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {current.options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setMcChoice(opt)}
                        className={`border px-4 py-3 text-left text-sm transition-colors ${
                          mcChoice === opt ? 'border-neon bg-neon/15 text-neon' : 'border-edge text-ink hover:border-neon/50'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* FILL */}
              {current.type === 'fill' && (
                <>
                  <p className="hud-label text-neon/70">ĐIỀN TỪ TIẾNG ANH</p>
                  <div className="text-center">
                    <span className="glow-accent text-2xl font-bold sm:text-3xl">{current.prompt}</span>
                  </div>
                  {current.example && (
                    <p className="text-center text-base leading-relaxed text-dim">“{blankExample(current.example, current.answer)}”</p>
                  )}
                  <input
                    value={fillText}
                    onChange={(e) => setFillText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && answered) submit() }}
                    autoFocus
                    placeholder="Nhập từ tiếng Anh..."
                    className="w-full bg-surface-2 border border-edge px-4 py-3 text-center text-lg text-ink outline-none focus:border-neon"
                  />
                </>
              )}

              {/* MATCH */}
              {current.type === 'match' && (
                <>
                  <p className="hud-label text-neon/70">GHÉP TỪ VỚI NGHĨA</p>
                  <div className="space-y-2">
                    {current.pairs.map((p) => (
                      <div key={p.term} className="flex min-w-0 flex-wrap items-center gap-3">
                        <span className="min-w-[8rem] text-lg font-bold text-neon">{p.term}</span>
                        <span className="text-dim">→</span>
                        <select
                          value={matchSel[p.term] || ''}
                          onChange={(e) => setMatchSel((s) => ({ ...s, [p.term]: e.target.value }))}
                          className="min-w-[12rem] flex-1 bg-surface-2 border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-neon"
                        >
                          <option value="">— chọn nghĩa —</option>
                          {current.options.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                onClick={submit}
                disabled={!answered}
                className="glow-neon border border-neon/60 px-6 py-2 text-sm tracking-wider text-neon transition-colors hover:bg-neon/10 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {qIndex < questions.length - 1 ? 'KIỂM TRA & TIẾP ▸' : 'XEM KẾT QUẢ ▸'}
              </button>
            </div>
          </div>
        )}

        {/* RESULT */}
        {stage === 'result' && (
          <div className="space-y-5">
            <div className="panel panel-accent hud-corners px-5 py-8 text-center">
              <div className="glow-accent text-6xl font-bold tabular-nums">{scorePct}%</div>
              <p className="hud-label mt-2 text-dim">
                ĐÚNG <span className="text-neon">{score}</span> / {responses.length} CÂU
              </p>
            </div>

            {wrong.length > 0 ? (
              <div className="panel hud-corners space-y-3 px-5 py-5">
                <p className="hud-label text-accent/80">XEM LẠI CÂU SAI ({wrong.length})</p>
                <ul className="space-y-3">
                  {wrong.map((r, i) => (
                    <li key={i} className="border-l-2 border-accent/60 pl-3 text-sm">
                      {r.question.type === 'match' ? (
                        <div className="space-y-1">
                          <p className="text-dim">Ghép cặp — đáp án đúng:</p>
                          {r.question.pairs.map((p) => (
                            <p key={p.term}>
                              <span className="text-neon">{p.term}</span>
                              <span className="text-dim"> → </span>
                              <span className="text-ink">{p.meaning}</span>
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p>
                          <span className="text-dim">{r.question.prompt} — </span>
                          <span className="text-ink">đáp án đúng: </span>
                          <span className="glow-neon font-bold">{r.question.answer}</span>
                          {r.given != null && r.given !== '' && (
                            <span className="text-dim"> (bạn trả lời: {String(r.given)})</span>
                          )}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="panel hud-corners px-5 py-6 text-center text-neon">🎉 Hoàn hảo! Tất cả đều đúng.</div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setStage('config')}
                className="border border-neon/60 px-5 py-2 text-sm tracking-wider text-neon transition-colors hover:bg-neon/10"
              >
                LÀM BÀI MỚI ▸
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
