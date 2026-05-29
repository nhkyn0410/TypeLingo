import { useEffect, useMemo, useState } from 'react'
import { getData, putData } from '../../api/client'
import { speak, shuffle } from '../../lib/util'

export default function Flashcards() {
  const [words, setWords] = useState([])
  const [loadError, setLoadError] = useState('')
  const [topic, setTopic] = useState('all')
  const [onlyUnlearned, setOnlyUnlearned] = useState(false)
  const [deckIds, setDeckIds] = useState([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    getData('vocabulary')
      .then((d) => setWords(Array.isArray(d) ? d : []))
      .catch((e) => setLoadError(e.message || 'Không tải được từ vựng.'))
  }, [])

  const topics = useMemo(
    () => Array.from(new Set(words.map((w) => w.topic).filter(Boolean))),
    [words],
  )

  // Dựng lại bộ thẻ khi đổi bộ lọc hoặc khi danh sách từ được thêm/bớt.
  useEffect(() => {
    const ids = words
      .filter((w) => (topic === 'all' || w.topic === topic) && (!onlyUnlearned || !w.learned))
      .map((w) => w.id)
    setDeckIds(ids)
    setIndex(0)
    setFlipped(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, onlyUnlearned, words.length])

  const byId = useMemo(() => new Map(words.map((w) => [w.id, w])), [words])
  const deck = useMemo(() => deckIds.map((id) => byId.get(id)).filter(Boolean), [deckIds, byId])
  const card = deck[index] || null

  const learnedCount = words.filter((w) => w.learned).length

  const setLearned = (id, learned) => {
    const next = words.map((w) => (w.id === id ? { ...w, learned } : w))
    setWords(next)
    putData('vocabulary', next).catch(() => {})
  }

  const go = (delta) => {
    setIndex((i) => Math.min(Math.max(i + delta, 0), Math.max(deck.length - 1, 0)))
    setFlipped(false)
  }

  const reshuffle = () => {
    setDeckIds((ids) => shuffle(ids))
    setIndex(0)
    setFlipped(false)
  }

  return (
    <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto w-full max-w-4xl min-w-0 space-y-6">
        {/* HEADER */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="glow-accent text-2xl font-bold tracking-[0.18em] sm:text-3xl">THẺ GHI NHỚ</h1>
            <p className="hud-label mt-2 flex items-center gap-2 text-dim">
              <span className="status-dot inline-block h-2 w-2 rounded-full bg-neon shadow-[0_0_8px_var(--color-neon)]" />
              KHẮC SÂU TỪ VỰNG VÀO BỘ NHỚ
            </p>
          </div>
          <div className="panel hud-corners flex items-baseline gap-2 px-5 py-3">
            <span className="glow-neon text-2xl font-bold tabular-nums">{learnedCount}</span>
            <span className="hud-label text-dim">/ {words.length} ĐÃ THUỘC</span>
          </div>
        </header>

        {/* CONTROLS */}
        <div className="panel flex min-w-0 flex-wrap items-center gap-3 px-4 py-3 sm:gap-4">
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="min-w-0 flex-1 bg-surface-2 border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-neon sm:flex-none"
          >
            <option value="all">Tất cả chủ đề</option>
            {topics.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <button
            onClick={() => setOnlyUnlearned((v) => !v)}
            className={`border px-3 py-2 text-xs tracking-wider transition-colors ${
              onlyUnlearned ? 'border-neon bg-neon/15 text-neon glow-neon' : 'border-edge text-dim hover:text-ink'
            }`}
          >
            CHỈ CHƯA THUỘC
          </button>

          <button
            onClick={reshuffle}
            disabled={deck.length < 2}
            className="border border-accent/50 px-3 py-2 text-xs tracking-wider text-accent transition-colors hover:bg-accent/10 disabled:opacity-30"
          >
            ⤮ TRỘN THẺ
          </button>

          <span className="hud-label ml-auto text-dim">
            THẺ <span className="text-ink">{deck.length ? index + 1 : 0}</span>/{deck.length}
          </span>
        </div>

        {loadError && <div className="panel panel-accent px-4 py-3 text-sm text-accent">{loadError}</div>}

        {/* CARD */}
        {!card ? (
          <div className="panel hud-corners flex min-h-[18rem] flex-col items-center justify-center gap-3 px-6 py-10 text-center text-dim">
            {words.length === 0 ? (
              <>
                <p className="text-lg">Chưa có từ vựng nào.</p>
                <p className="text-sm">Hãy thêm từ ở mục <span className="text-neon">TỪ VỰNG</span> để bắt đầu.</p>
              </>
            ) : (
              <>
                <p className="glow-neon text-2xl">🎉</p>
                <p className="text-lg">Đã ôn hết các thẻ trong bộ lọc này.</p>
                <p className="text-sm">Bỏ lọc "chưa thuộc" hoặc đổi chủ đề để ôn tiếp.</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <button
              onClick={() => setFlipped((f) => !f)}
              className={`panel hud-corners group grid h-[18rem] w-full grid-rows-[auto_1fr_auto] px-6 py-8 text-center transition-colors sm:h-[20rem] ${
                flipped ? 'panel-accent' : ''
              }`}
            >
              <div className="hud-label mb-4 flex items-center justify-center gap-3 text-dim">
                <span>{flipped ? 'NGHĨA' : 'TỪ'}</span>
                {card.topic && <span className="border border-edge px-2 py-0.5 text-[10px] text-neon/70">{card.topic}</span>}
                {card.learned && <span className="text-neon">✓ ĐÃ THUỘC</span>}
              </div>

              {!flipped ? (
                <div className="flex min-h-0 flex-col items-center justify-center gap-4 overflow-hidden">
                  <span className="glow-neon text-4xl font-bold sm:text-5xl">{card.term}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); speak(card.term) }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); speak(card.term) } }}
                    className="text-dim transition-colors hover:text-neon"
                    title="Đọc to"
                    aria-label="Đọc to từ"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                  </span>
                </div>
              ) : (
                <div className="flex min-h-0 flex-col items-center justify-center gap-3 overflow-y-auto px-1">
                  <span className="glow-accent text-3xl font-bold sm:text-4xl">{card.meaning}</span>
                  {card.example && (
                    <div className="max-w-xl space-y-1 text-base leading-relaxed">
                      <p className="text-ink/90">“{card.example}”</p>
                      <p className="text-sm text-dim">{card.exampleVi || 'Chưa có bản dịch câu ví dụ.'}</p>
                    </div>
                  )}
                </div>
              )}

              <p className="hud-label mt-6 text-dim/60">▸ NHẤN ĐỂ LẬT THẺ</p>
            </button>

            {/* ACTIONS */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => go(-1)}
                disabled={index <= 0}
                className="border border-edge px-4 py-2 text-xs tracking-wider text-dim transition-colors hover:text-ink disabled:opacity-30"
              >
                ◂ TRƯỚC
              </button>

              <div className="flex min-w-[14rem] flex-1 gap-2">
                <button
                  onClick={() => setLearned(card.id, false)}
                  className={`flex-1 border px-3 py-2 text-xs tracking-wider transition-colors ${
                    !card.learned ? 'border-accent bg-accent/15 text-accent glow-accent' : 'border-edge text-dim hover:text-ink'
                  }`}
                >
                  CHƯA THUỘC
                </button>
                <button
                  onClick={() => setLearned(card.id, true)}
                  className={`flex-1 border px-3 py-2 text-xs tracking-wider transition-colors ${
                    card.learned ? 'border-neon bg-neon/15 text-neon glow-neon' : 'border-edge text-dim hover:text-ink'
                  }`}
                >
                  ĐÃ THUỘC ✓
                </button>
              </div>

              <button
                onClick={() => go(1)}
                disabled={index >= deck.length - 1}
                className="border border-neon/60 px-4 py-2 text-xs tracking-wider text-neon transition-colors hover:bg-neon/10 disabled:opacity-30"
              >
                TIẾP ▸
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
