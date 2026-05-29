import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getData, putData, getProviders, translateDocument, analyzeSentence, defineVocabulary } from '../../api/client'
import { speak, makeId } from '../../lib/util'
import { countWords, gradeTranslation } from './grading'
import { collectEnglishTerms, newTermsAmong, mergeVocabulary, normalizeWord, wordMatches } from './vocabularyExtract'

// Hai chiều dịch: nguồn → đích.
const DIRECTIONS = {
  'en-vi': { srcKey: 'en', dstKey: 'vi', srcLabel: 'TIẾNG ANH', dstLabel: 'TIẾNG VIỆT', srcShort: 'ANH', dstShort: 'VIỆT', srcLang: 'en-US' },
  'vi-en': { srcKey: 'vi', dstKey: 'en', srcLabel: 'TIẾNG VIỆT', dstLabel: 'TIẾNG ANH', srcShort: 'VIỆT', dstShort: 'ANH', srcLang: 'vi-VN' },
}

// Màu & nhãn cho từng loại lỗi do AI phân loại.
const TYPE_META = {
  structure: { label: 'CẤU TRÚC', text: 'text-violet-300', bg: 'bg-violet-500/10', border: 'border-violet-400/50' },
  grammar: { label: 'NGỮ PHÁP', text: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-400/50' },
  vocabulary: { label: 'TỪ VỰNG', text: 'text-neon', bg: 'bg-neon/10', border: 'border-neon/50' },
  context: { label: 'NGỮ CẢNH', text: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/50' },
}
const metaOf = (t) => TYPE_META[t] || TYPE_META.context

function splitParagraph(text) {
  const value = (text || '').trim()
  if (!value) return []

  const lines = value.split(/\n+/).map((s) => s.trim()).filter(Boolean)
  if (lines.length > 1) return lines

  const matches = value.match(/[^.!?。！？]+(?:[.!?。！？]+|$)/g) || [value]
  return matches.map((s) => s.trim()).filter(Boolean)
}

function getTypingWord(text) {
  const match = (text || '').match(/[\p{L}\p{N}]+$/u)
  return match?.[0] || ''
}

function getHintRemainder(hint, input) {
  if (!hint) return ''
  if (!input) return hint

  const typedWords = wordMatches(input)
  const hintWords = wordMatches(hint)
  const typing = getTypingWord(input)
  const completedCount = typing ? Math.max(typedWords.length - 1, 0) : typedWords.length
  const currentHint = hintWords[completedCount]

  if (!currentHint) return ''
  const currentStart = currentHint.index
  const currentText = currentHint[0]
  if (typing && normalizeWord(currentText).startsWith(normalizeWord(typing))) {
    return hint.slice(currentStart + typing.length)
  }
  if (typing) return ''
  return hint.slice(currentStart)
}

// Tô các đoạn sai (substring khớp chính xác) trên câu người dùng gõ.
function renderUserText(userText, errors) {
  if (!errors || errors.length === 0) return userText
  const ranges = []
  for (const err of errors) {
    const needle = err.text
    if (!needle) continue
    let from = 0
    while (from <= userText.length) {
      const idx = userText.indexOf(needle, from)
      if (idx === -1) break
      const end = idx + needle.length
      if (!ranges.some((r) => idx < r.end && end > r.start)) {
        ranges.push({ start: idx, end, err })
        break
      }
      from = idx + 1
    }
  }
  if (ranges.length === 0) return userText
  ranges.sort((a, b) => a.start - b.start)
  const out = []
  let cursor = 0
  ranges.forEach((r, k) => {
    if (r.start > cursor) out.push(<span key={`t${k}`}>{userText.slice(cursor, r.start)}</span>)
    const meta = metaOf(r.err.type)
    const tip = `${meta.label}${r.err.suggestion ? ` → ${r.err.suggestion}` : ''}${r.err.note ? `\n${r.err.note}` : ''}`
    out.push(
      <span
        key={`e${k}`}
        title={tip}
        className={`rounded-sm px-0.5 underline decoration-wavy decoration-2 underline-offset-2 ${meta.text} ${meta.bg}`}
      >
        {userText.slice(r.start, r.end)}
      </span>,
    )
    cursor = r.end
  })
  if (cursor < userText.length) out.push(<span key="tail">{userText.slice(cursor)}</span>)
  return out
}

function renderLocalUserText(userText, local) {
  const refSet = new Set((local?.refWords || []).map((w) => normalizeWord(w.text)).filter(Boolean))
  if (!refSet.size) return userText
  return (userText || '').split(/(\s+)/).map((chunk, i) => {
    if (!chunk || /^\s+$/.test(chunk)) return <span key={i}>{chunk}</span>
    const norm = normalizeWord(chunk)
    const extra = norm && !refSet.has(norm)
    return (
      <span
        key={i}
        className={extra ? 'rounded-sm bg-red-500/10 px-0.5 text-red-300 underline decoration-red-300/80 decoration-wavy underline-offset-2' : ''}
        title={extra ? 'Từ này chưa xuất hiện trong bản tham chiếu.' : undefined}
      >
        {chunk}
      </span>
    )
  })
}

function renderReferenceDiff(local, reference) {
  if (!local?.refWords?.length) return reference || '-'
  return local.refWords.map((word, i) => {
    if (word.space) return <span key={i}>{word.text}</span>
    const missing = !word.matched
    return (
      <span
        key={i}
        className={missing ? 'rounded-sm bg-amber-400/15 px-0.5 text-amber-200 underline decoration-amber-300 decoration-wavy underline-offset-2' : 'text-neon/80'}
        title={missing ? 'Từ tham chiếu chưa được gõ khớp.' : undefined}
      >
        {word.text}
      </span>
    )
  })
}

export default function TranslatePractice() {
  const [exercises, setExercises] = useState([])
  const [vocabulary, setVocabulary] = useState([])
  const [loadError, setLoadError] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [direction, setDirection] = useState('en-vi')

  // Luồng dịch đoạn.
  const [committed, setCommitted] = useState([]) // [{ key, i, userText, reference, local, wpm, ms, ai, aiStatus, aiError, showRef }]
  const [input, setInput] = useState('')
  const [liveWpm, setLiveWpm] = useState(null)
  const [showHint, setShowHint] = useState(false)
  const [inputScrollTop, setInputScrollTop] = useState(0)

  // Phân tích AI.
  const [aiOn, setAiOn] = useState(true)
  const [providers, setProviders] = useState([])
  const [aiProvider, setAiProvider] = useState('')

  // Tạo bài.
  const [showCreate, setShowCreate] = useState(false)
  const [createMode, setCreateMode] = useState('manual') // 'manual' | 'ai'
  const [newTitle, setNewTitle] = useState('')
  const [newEn, setNewEn] = useState('')
  const [newVi, setNewVi] = useState('')
  const [createError, setCreateError] = useState('')
  const [createNotice, setCreateNotice] = useState('')
  const [aiDirection, setAiDirection] = useState('en-vi')
  const [aiType, setAiType] = useState('txt')
  const [aiSource, setAiSource] = useState('')
  const [aiBusy, setAiBusy] = useState(false)

  const startRef = useRef(null) // thời điểm gõ phím đầu của đoạn hiện tại
  const statsRef = useRef([])
  const inputRef = useRef(null)
  const idRef = useRef(0) // khóa duy nhất cho mỗi câu đã chốt
  const epochRef = useRef(0) // tăng khi đổi bài/đổi chiều để bỏ qua kết quả AI cũ
  const abortersRef = useRef(new Set())

  // Nạp danh sách bài + thống kê + nhà cung cấp.
  useEffect(() => {
    getData('exercises')
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        setExercises(list)
        if (list.length) setSelectedId(list[0].id)
      })
      .catch((err) => setLoadError(err.message || 'Không tải được danh sách bài.'))
    getData('translate-stats')
      .then((data) => { statsRef.current = Array.isArray(data) ? data : [] })
      .catch(() => { statsRef.current = [] })
    getData('vocabulary')
      .then((data) => setVocabulary(Array.isArray(data) ? data : []))
      .catch(() => setVocabulary([]))
    getProviders()
      .then((data) => {
        const list = Array.isArray(data?.providers) ? data.providers : []
        setProviders(list)
        const def = list.find((p) => p.isDefault && p.configured) || list.find((p) => p.configured)
        if (def) setAiProvider(def.name)
      })
      .catch(() => setProviders([]))
  }, [])

  const exercise = useMemo(() => exercises.find((e) => e.id === selectedId) || null, [exercises, selectedId])
  const pairs = useMemo(() => exercise?.pairs || [], [exercise])
  const dir = DIRECTIONS[direction]
  const sentences = useMemo(() => pairs.map((p) => p[dir.srcKey] || ''), [pairs, dir.srcKey])
  const references = useMemo(() => pairs.map((p) => p[dir.dstKey] || ''), [pairs, dir.dstKey])

  const total = sentences.length
  const submittedCount = Math.min(committed.length, total)
  const finished = total > 0 && submittedCount >= total
  const sourcePassage = sentences.join(' ')
  const hintText = useMemo(() => references.slice(submittedCount).join(' '), [references, submittedCount])
  const hintRemainder = useMemo(() => getHintRemainder(hintText, input), [hintText, input])
  const typingWord = useMemo(() => getTypingWord(input), [input])
  const vocabularyByTerm = useMemo(() => new Map(vocabulary.map((w) => [normalizeWord(w.term), w])), [vocabulary])
  const wordAnalysis = useMemo(() => {
    const normalized = normalizeWord(typingWord)
    const tokens = hintText.match(/[\p{L}\p{N}]+/gu) || []
    const normalizedTokens = tokens.map((token) => normalizeWord(token)).filter(Boolean)
    const exactIndex = normalized ? normalizedTokens.indexOf(normalized) : -1
    const partialIndex = normalized ? normalizedTokens.findIndex((token) => token.startsWith(normalized) && token !== normalized) : -1
    const typedCount = input.match(/[\p{L}\p{N}]+/gu)?.length || 0
    const expected = tokens[Math.min(Math.max(typedCount - 1, 0), Math.max(tokens.length - 1, 0))] || ''
    const expectedNorm = normalizeWord(expected)
    const mismatch = !!normalized && !!expectedNorm && !expectedNorm.startsWith(normalized)

    return {
      text: typingWord,
      expected,
      vocab: vocabularyByTerm.get(normalized) || vocabularyByTerm.get(normalizeWord(expected)) || null,
      mismatch,
      exact: exactIndex >= 0,
      partial: exactIndex < 0 && partialIndex >= 0,
      suggestion: partialIndex >= 0 ? tokens[partialIndex] : '',
      position: exactIndex >= 0 ? exactIndex + 1 : partialIndex >= 0 ? partialIndex + 1 : null,
      total: normalizedTokens.length,
    }
  }, [hintText, input, typingWord, vocabularyByTerm])

  const aiAvailable = providers.some((p) => p.configured)
  const aiEnabled = aiOn && aiAvailable && !!aiProvider

  const abortAll = useCallback(() => {
    for (const c of abortersRef.current) c.abort()
    abortersRef.current.clear()
  }, [])

  // Đặt lại đoạn (đổi bài/đổi chiều/làm lại).
  const resetPassage = useCallback(() => {
    epochRef.current += 1
    abortAll()
    setCommitted([])
    setInput('')
    setLiveWpm(null)
    setShowHint(false)
    setInputScrollTop(0)
    startRef.current = null
  }, [abortAll])

  // Tự focus ô nhập khi đổi bài / đổi chiều.
  useEffect(() => {
    if (!finished) inputRef.current?.focus()
  }, [selectedId, direction, finished])

  const recordStat = useCallback(
    (s) => {
      if (!exercise) return
      const entry = {
        exerciseId: exercise.id,
        pairIndex: s.i,
        direction,
        similarity: s.similarity ?? null,
        wpm: s.wpm ?? null,
        ms: s.ms ?? null,
        words: s.words ?? null,
        at: new Date().toISOString(),
      }
      const next = [...statsRef.current, entry]
      statsRef.current = next
      putData('translate-stats', next).catch(() => {})
    },
    [exercise, direction],
  )

  // Rã CHỈ từ tiếng Anh trong bài; với từ mới, gọi AI sinh nghĩa + ví dụ RIÊNG (gộp 1 request).
  const expandVocabulary = useCallback(async (pairsForVocab, title) => {
    const terms = collectEnglishTerms(pairsForVocab)
    if (!terms.length) return

    const newTerms = newTermsAmong(vocabulary, terms)
    const defsByTerm = {}

    if (newTerms.length && aiProvider) {
      // Ưu tiên từ xuất hiện nhiều; gộp mọi từ mới trong MỘT lần gọi (giới hạn để tránh lô quá lớn).
      const words = [...newTerms]
        .sort((a, b) => (b.frequency || 0) - (a.frequency || 0))
        .slice(0, 60)
        .map((t) => t.term)
      try {
        const res = await defineVocabulary({ words, provider: aiProvider })
        const entries = Array.isArray(res?.entries) ? res.entries : []
        // Map theo THỨ TỰ gửi đi (AI có thể đổi "term" sang dạng gốc) để gán đúng từ đã rã.
        words.forEach((w, i) => {
          const e = entries[i]
          if (e) defsByTerm[normalizeWord(w)] = e
        })
      } catch {
        // Lỗi AI/mạng — vẫn thêm từ với nghĩa/ví dụ để trống cho người dùng tự điền sau.
      }
    }

    const { next, added } = mergeVocabulary(vocabulary, terms, defsByTerm, title)
    if (added > 0) {
      setVocabulary(next)
      putData('vocabulary', next).catch(() => {})
    }
  }, [vocabulary, aiProvider])

  const handleInput = useCallback((e) => {
    const v = e.target.value
    setInput(v)
    if (startRef.current == null && v.length > 0) startRef.current = performance.now()
    if (startRef.current != null) {
      const minutes = (performance.now() - startRef.current) / 60000
      setLiveWpm(minutes > 0 ? Math.round(countWords(v) / minutes) : null)
    }
  }, [])

  // Chốt cả đoạn người dùng gõ, rồi phân tích từng câu ở khung bên phải.
  const commitPassage = useCallback(() => {
    const rawText = input.trim()
    if (!rawText) return

    const startAt = committed.length
    if (startAt >= total) return

    const chunks = splitParagraph(rawText).slice(0, total - startAt)
    if (!chunks.length) return

    const ms = startRef.current != null ? performance.now() - startRef.current : null
    const totalWords = countWords(rawText)
    const wpmVal = ms && totalWords ? Math.round(totalWords / (ms / 60000)) : null
    const willUseAI = aiEnabled && !showHint

    const entries = chunks.map((text, offset) => {
      const i = startAt + offset
      const reference = references[i] || ''
      const local = gradeTranslation(text, reference)
      const words = countWords(text)
      const partMs = ms && totalWords ? (ms * words) / totalWords : ms
      const entryWpm = partMs && words ? Math.round(words / (partMs / 60000)) : wpmVal
      return {
        key: ++idRef.current,
        i,
        userText: text,
        reference,
        local,
        wpm: entryWpm,
        ms: partMs,
        ai: null,
        aiStatus: willUseAI ? 'pending' : 'off',
        aiError: '',
        showRef: false,
      }
    })

    setCommitted((prev) => [...prev, ...entries])
    entries.forEach((entry) => {
      recordStat({ i: entry.i, similarity: entry.local.similarity, wpm: entry.wpm, ms: entry.ms, words: countWords(entry.userText) })
    })

    setInput('')
    startRef.current = null
    setLiveWpm(null)
    setInputScrollTop(0)

    if (willUseAI) {
      const epoch = epochRef.current
      entries.forEach((entry) => {
        const controller = new AbortController()
        abortersRef.current.add(controller)
        analyzeSentence({ source: sentences[entry.i], reference: entry.reference, user: entry.userText, direction, provider: aiProvider, signal: controller.signal })
          .then((res) => {
            if (epoch !== epochRef.current) return
            setCommitted((prev) => prev.map((en) => (en.key === entry.key ? { ...en, ai: res, aiStatus: 'done' } : en)))
          })
          .catch((err) => {
            if (controller.signal.aborted || epoch !== epochRef.current) return
            setCommitted((prev) => prev.map((en) => (en.key === entry.key ? { ...en, aiStatus: 'error', aiError: err?.message || 'Lỗi phân tích' } : en)))
          })
          .finally(() => abortersRef.current.delete(controller))
      })
    }
  }, [input, committed.length, total, references, sentences, aiEnabled, aiProvider, direction, recordStat, showHint])

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        commitPassage()
      }
    },
    [commitPassage],
  )

  const changeExercise = useCallback((id) => { setSelectedId(id); resetPassage() }, [resetPassage])
  const changeDirection = useCallback((d) => { setDirection(d); resetPassage() }, [resetPassage])
  const toggleRef = useCallback((key) => {
    setCommitted((prev) => prev.map((en) => (en.key === key ? { ...en, showRef: !en.showRef } : en)))
  }, [])

  const handleUploadDocument = useCallback(async (file) => {
    if (!file) return
    setCreateError('')
    setCreateNotice('')
    try {
      const content = await file.text()
      const ext = file.name.split('.').pop()?.toLowerCase() || 'txt'
      const type = ['txt', 'md', 'json'].includes(ext) ? ext : 'txt'
      const titleFromFile = file.name.replace(/\.[^.]+$/, '').trim()
      if (!newTitle.trim() && titleFromFile) setNewTitle(titleFromFile)

      if (type === 'json') {
        try {
          const parsed = JSON.parse(content)
          if (Array.isArray(parsed) && parsed.every((p) => typeof p?.en === 'string' && typeof p?.vi === 'string')) {
            setCreateMode('manual')
            setNewEn(parsed.map((p) => p.en).join('\n'))
            setNewVi(parsed.map((p) => p.vi).join('\n'))
            setCreateNotice(`Đã nạp ${parsed.length} cặp câu từ ${file.name}.`)
            return
          }
        } catch {
          // Nếu không phải JSON cặp câu hợp lệ thì vẫn nạp như tài liệu thường.
        }
      }

      setCreateMode('ai')
      setAiType(type)
      setAiSource(content)
      setCreateNotice(`Đã tải ${file.name} vào tài liệu nguồn.`)
    } catch (err) {
      setCreateError(err?.message || 'Không đọc được tệp.')
    }
  }, [newTitle])

  // Tạo bài từ văn bản song ngữ: ghép từng dòng EN ↔ VI.
  const handleCreate = useCallback(() => {
    const enLines = newEn.split('\n').map((s) => s.trim()).filter(Boolean)
    const viLines = newVi.split('\n').map((s) => s.trim()).filter(Boolean)
    if (!newTitle.trim()) { setCreateError('Cần nhập tiêu đề bài.'); return }
    if (enLines.length === 0 || enLines.length !== viLines.length) {
      setCreateError('Số dòng tiếng Anh và tiếng Việt phải bằng nhau và khác 0.')
      return
    }
    const newPairs = enLines.map((en, i) => ({ en, vi: viLines[i] }))
    const created = { id: makeId(newTitle.trim()), title: newTitle.trim(), pairs: newPairs }
    const next = [...exercises, created]
    setExercises(next)
    setShowCreate(false)
    setNewTitle(''); setNewEn(''); setNewVi(''); setCreateError(''); setCreateNotice('')
    expandVocabulary(newPairs, created.title).catch(() => {})
    changeExercise(created.id)
    putData('exercises', next).catch((err) => setCreateError(err.message || 'Lưu bài thất bại.'))
  }, [newEn, newVi, newTitle, exercises, changeExercise, expandVocabulary])

  // Tạo bài bằng AI: gửi văn bản nguồn → backend dịch → ghép cặp { en, vi }.
  const handleAiCreate = useCallback(async () => {
    if (!newTitle.trim()) { setCreateError('Cần nhập tiêu đề bài.'); return }
    if (!aiSource.trim()) { setCreateError('Cần dán nội dung tài liệu để dịch.'); return }
    if (!aiProvider) { setCreateError('Chưa có nhà cung cấp AI nào được cấu hình. Vào tab CẤU HÌNH để nhập API key.'); return }
    setCreateError(''); setAiBusy(true)
    try {
      const res = await translateDocument({ content: aiSource, type: aiType, direction: aiDirection, provider: aiProvider })
      const aiPairs = Array.isArray(res?.pairs) ? res.pairs : []
      if (!aiPairs.length) { setCreateError('Không nhận được cặp câu nào từ kết quả dịch.'); return }
      const created = { id: makeId(newTitle.trim()), title: newTitle.trim(), pairs: aiPairs }
      const next = [...exercises, created]
      setExercises(next)
      putData('exercises', next).catch((err) => setCreateError(err.message || 'Lưu bài thất bại.'))
      setCreateNotice('Đang tạo nghĩa và ví dụ cho từ vựng mới…')
      await expandVocabulary(aiPairs, created.title)
      setShowCreate(false)
      setNewTitle(''); setAiSource(''); setCreateNotice('')
      changeExercise(created.id)
    } catch (err) {
      setCreateError(err.message || 'Dịch thất bại.')
    } finally {
      setAiBusy(false)
    }
  }, [newTitle, aiSource, aiProvider, aiType, aiDirection, exercises, changeExercise, expandVocabulary])

  const progressPct = total ? Math.round((submittedCount / total) * 100) : 0

  // Tổng kết khi xong đoạn.
  const summary = useMemo(() => {
    if (!committed.length) return null
    const avgLocal = Math.round(committed.reduce((s, c) => s + (c.local?.similarity || 0), 0) / committed.length)
    const doneAI = committed.filter((c) => c.aiStatus === 'done' && c.ai?.score != null)
    const avgAI = doneAI.length ? Math.round(doneAI.reduce((s, c) => s + c.ai.score, 0) / doneAI.length) : null
    const wpms = committed.map((c) => c.wpm).filter((w) => w != null)
    const avgWpm = wpms.length ? Math.round(wpms.reduce((a, b) => a + b, 0) / wpms.length) : null
    const totalErrors = committed.reduce((s, c) => s + (c.ai?.errors?.length || 0), 0)
    return { avgLocal, avgAI, avgWpm, totalErrors }
  }, [committed])

  return (
    <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6">
        {/* HEADER */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="glow-accent text-2xl font-bold tracking-[0.18em] sm:text-3xl">LUYỆN DỊCH VÀ GÕ</h1>
            <p className="hud-label mt-2 flex items-center gap-2 text-dim">
              <span className="status-dot inline-block h-2 w-2 rounded-full bg-neon shadow-[0_0_8px_var(--color-neon)]" />
              DỊCH CẢ ĐOẠN · PHÂN TÍCH LỖI BẰNG AI
            </p>
          </div>
          <div className="panel hud-corners flex items-baseline gap-2 px-5 py-3">
            <span className="glow-neon text-2xl font-bold tabular-nums">{liveWpm ?? '--'}</span>
            <span className="hud-label text-dim">WPM</span>
          </div>
        </header>

        {/* CONTROLS */}
        <div className="panel flex min-w-0 flex-wrap items-center gap-3 px-4 py-3 sm:gap-4">
          <select
            value={selectedId}
            onChange={(e) => changeExercise(e.target.value)}
            className="min-w-[12rem] flex-1 bg-surface-2 border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-neon sm:flex-none"
          >
            {exercises.length === 0 && <option value="">(chưa có bài)</option>}
            {exercises.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>

          <div className="flex border border-edge">
            {Object.entries(DIRECTIONS).map(([key, d]) => (
              <button
                key={key}
                onClick={() => changeDirection(key)}
                className={`px-3 py-2 text-xs tracking-wider transition-colors ${
                  direction === key ? 'bg-neon/15 text-neon glow-neon' : 'text-dim hover:text-ink'
                }`}
              >
                {d.srcShort} → {d.dstShort}
              </button>
            ))}
          </div>

          {/* Công tắc AI + chọn nhà cung cấp */}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <button
              onClick={() => setAiOn((v) => !v)}
              disabled={!aiAvailable}
              title={aiAvailable ? 'Bật/tắt phân tích bằng AI' : 'Chưa cấu hình AI — vào tab CẤU HÌNH để nhập API key'}
              className={`border px-3 py-2 text-xs tracking-wider transition-colors disabled:opacity-40 ${
                aiEnabled ? 'border-accent/60 bg-accent/15 text-accent glow-accent' : 'border-edge text-dim hover:text-ink'
              }`}
            >
              AI: {aiEnabled ? 'BẬT' : 'TẮT'}
            </button>
            {aiOn && aiAvailable && (
              <select
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value)}
                className="min-w-[10rem] flex-1 bg-surface-2 border border-edge px-2 py-2 text-xs text-ink outline-none focus:border-accent sm:flex-none"
              >
                {providers.map((p) => (
                  <option key={p.name} value={p.name} disabled={!p.configured}>
                    {p.name}{p.configured ? '' : ' (chưa cấu hình)'}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            onClick={() => setShowCreate((v) => !v)}
            className="border border-accent/50 px-3 py-2 text-xs tracking-wider text-accent transition-colors hover:bg-accent/10"
          >
            + TẠO BÀI
          </button>

          <button
            onClick={resetPassage}
            disabled={total === 0 && !input.trim()}
            className="border border-edge px-3 py-2 text-xs tracking-wider text-dim transition-colors hover:text-neon disabled:cursor-not-allowed disabled:opacity-30"
          >
            LÀM LẠI BÀI
          </button>

          <span className="hud-label ml-auto text-dim">
            ĐÃ GỬI <span className="text-ink">{submittedCount}</span>/{total}
          </span>
        </div>

        {loadError && <div className="panel panel-accent px-4 py-3 text-sm text-accent">{loadError}</div>}

        {/* CREATE PANEL */}
        {showCreate && (
          <div className="panel hud-corners space-y-3 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="hud-label text-accent/80">TẠO BÀI MỚI</p>
              <div className="flex border border-edge">
                <button
                  onClick={() => { setCreateMode('manual'); setCreateError(''); setCreateNotice('') }}
                  className={`px-3 py-2 text-xs tracking-wider transition-colors ${
                    createMode === 'manual' ? 'bg-neon/15 text-neon glow-neon' : 'text-dim hover:text-ink'
                  }`}
                >
                  NHẬP SONG NGỮ
                </button>
                <button
                  onClick={() => { setCreateMode('ai'); setCreateError(''); setCreateNotice('') }}
                  className={`px-3 py-2 text-xs tracking-wider transition-colors ${
                    createMode === 'ai' ? 'bg-accent/15 text-accent glow-accent' : 'text-dim hover:text-ink'
                  }`}
                >
                  TẠO BẰNG AI
                </button>
              </div>
            </div>

            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Tiêu đề bài..."
              className="w-full bg-surface-2 border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-neon"
            />

            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <label className="border border-neon/50 px-3 py-2 text-xs tracking-wider text-neon transition-colors hover:bg-neon/10">
                TẢI TỆP BÀI/DỮ LIỆU
                <input
                  type="file"
                  accept=".txt,.md,.json,text/plain,text/markdown,application/json"
                  disabled={aiBusy}
                  onChange={(e) => {
                    handleUploadDocument(e.target.files?.[0])
                    e.target.value = ''
                  }}
                  className="sr-only"
                />
              </label>
              <span className="hud-label min-w-[14rem] flex-1 text-dim">JSON MẢNG EN/VI: NẠP VÀO SONG NGỮ · TXT/MD/JSON TÀI LIỆU: ĐƯA VÀO TẠO BẰNG AI</span>
            </div>

            {createMode === 'manual' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <textarea
                  value={newEn}
                  onChange={(e) => setNewEn(e.target.value)}
                  placeholder="Dán đoạn văn tiếng Anh..."
                  rows={6}
                  className="min-w-0 w-full resize-y bg-surface-2 border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-neon"
                />
                <textarea
                  value={newVi}
                  onChange={(e) => setNewVi(e.target.value)}
                  placeholder="Dán bản dịch tiếng Việt cùng thứ tự..."
                  rows={6}
                  className="min-w-0 w-full resize-y bg-surface-2 border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-neon"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={aiSource}
                  onChange={(e) => setAiSource(e.target.value)}
                  placeholder="Dán tài liệu nguồn chưa có bản dịch. AI sẽ tách câu, dịch và tạo bài luyện..."
                  rows={6}
                  disabled={aiBusy}
                  className="min-w-0 w-full resize-y bg-surface-2 border border-edge px-3 py-2 text-sm text-ink outline-none focus:border-accent disabled:opacity-50"
                />
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                  <label className="hud-label text-dim">ĐỊNH DẠNG</label>
                  <select
                    value={aiType}
                    onChange={(e) => setAiType(e.target.value)}
                    disabled={aiBusy}
                    className="min-w-[5rem] bg-surface-2 border border-edge px-2 py-2 text-xs text-ink outline-none focus:border-accent disabled:opacity-50"
                  >
                    <option value="txt">txt</option>
                    <option value="md">md</option>
                    <option value="json">json</option>
                  </select>

                  <div className="flex border border-edge">
                    {Object.entries(DIRECTIONS).map(([key, d]) => (
                      <button
                        key={key}
                        onClick={() => setAiDirection(key)}
                        disabled={aiBusy}
                        className={`px-3 py-2 text-xs tracking-wider transition-colors disabled:opacity-50 ${
                          aiDirection === key ? 'bg-accent/15 text-accent glow-accent' : 'text-dim hover:text-ink'
                        }`}
                      >
                        {d.srcShort} → {d.dstShort}
                      </button>
                    ))}
                  </div>

                  <label className="hud-label sm:ml-auto text-dim">AI</label>
                  <select
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value)}
                    disabled={aiBusy}
                    className="min-w-[12rem] flex-1 bg-surface-2 border border-edge px-2 py-2 text-xs text-ink outline-none focus:border-accent disabled:opacity-50 sm:flex-none"
                  >
                    {providers.length === 0 && <option value="">(không có)</option>}
                    {providers.map((p) => (
                      <option key={p.name} value={p.name} disabled={!p.configured}>
                        {p.name}{p.configured ? ` · ${p.model}` : ' (chưa cấu hình)'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {createNotice && <p className="text-xs text-neon/80">{createNotice}</p>}
            {createError && <p className="text-xs text-accent">{createError}</p>}

            <div className="flex flex-wrap items-center gap-3">
              {createMode === 'manual' ? (
                <button
                  onClick={handleCreate}
                  className="border border-neon/60 px-4 py-2 text-xs tracking-wider text-neon transition-colors hover:bg-neon/10"
                >
                  LƯU BÀI SONG NGỮ ▸
                </button>
              ) : (
                <button
                  onClick={handleAiCreate}
                  disabled={aiBusy}
                  className="glow-accent border border-accent/60 px-4 py-2 text-xs tracking-wider text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {aiBusy ? 'ĐANG TẠO BÀI…' : 'DỊCH TÀI LIỆU & TẠO BÀI ▸'}
                </button>
              )}
              <button
                onClick={() => setShowCreate(false)}
                disabled={aiBusy}
                className="px-4 py-2 text-xs tracking-wider text-dim hover:text-ink disabled:opacity-50"
              >
                HỦY
              </button>
            </div>
          </div>
        )}

        {/* PROGRESS */}
        <div className="h-1 w-full bg-surface-2">
          <div className="h-full bg-gradient-to-r from-neon to-accent transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="grid min-h-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] lg:items-start">
          <div className="min-w-0 space-y-5">
            <section className="space-y-2">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                <p className="hud-label text-neon/70">ĐOẠN NGUỒN ({dir.srcLabel})</p>
                <button
                  onClick={() => speak(sourcePassage, dir.srcLang)}
                  disabled={!sourcePassage}
                  className="shrink-0 text-dim transition-colors hover:text-neon disabled:opacity-30"
                  title="Đọc to đoạn nguồn"
                  aria-label="Đọc to đoạn nguồn"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                </button>
              </div>
              <div className="panel hud-corners h-56 overflow-y-auto px-6 py-5 text-lg leading-relaxed lg:h-72">
                {total === 0 ? (
                  <span className="text-dim">- chưa có bài. Bấm '+ TẠO BÀI' để thêm đoạn. -</span>
                ) : (
                  sentences.map((s, i) => (
                    <span
                      key={i}
                      className={
                        i === submittedCount && !finished
                          ? 'rounded bg-neon/20 px-1 text-ink shadow-[0_0_10px_rgba(45,226,255,0.25)]'
                          : i < submittedCount
                            ? 'text-neon/50'
                            : 'text-dim/60'
                      }
                    >
                      {s}{' '}
                    </span>
                  ))
                )}
              </div>
            </section>

            {!finished ? (
              total > 0 && (
                <section className="space-y-2">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                    <p className="hud-label text-neon/70">GÕ BẢN DỊCH CẢ ĐOẠN ({dir.dstLabel})</p>
                    <div className="flex min-w-0 flex-wrap items-center gap-3">
                      <button
                        onClick={() => setShowHint((v) => !v)}
                        disabled={!hintText}
                        className={`border px-3 py-1.5 text-xs tracking-wider transition-colors disabled:opacity-30 ${
                          showHint ? 'border-accent/60 bg-accent/15 text-accent glow-accent' : 'border-edge text-dim hover:text-ink'
                        }`}
                      >
                        GỢI Ý
                      </button>
                      <span className="hud-label text-dim">CÒN {Math.max(total - submittedCount, 0)} CÂU</span>
                    </div>
                  </div>
                  <div className="panel hud-corners relative p-3">
                    {showHint && hintText && (
                      <HintOverlay input={input} hintRemainder={hintRemainder} analysis={wordAnalysis} scrollTop={inputScrollTop} />
                    )}
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={handleInput}
                      onKeyDown={handleKeyDown}
                      onScroll={(e) => setInputScrollTop(e.currentTarget.scrollTop)}
                      placeholder={showHint ? '' : 'Gõ toàn bộ đoạn dịch ở đây. Nhấn Enter để bắt đầu phân tích, Shift+Enter để xuống dòng.'}
                      rows={8}
                      className="relative z-10 h-64 w-full resize-none overflow-y-auto bg-transparent px-6 pb-6 pt-16 text-lg leading-relaxed text-ink outline-none placeholder:text-dim/60"
                    />
                  </div>
                  <TypingWordPanel analysis={wordAnalysis} showHint={showHint} />
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                    <span className="hud-label text-dim">{countWords(input)} TỪ · ENTER PHÂN TÍCH · SHIFT+ENTER XUỐNG DÒNG</span>
                    <button
                      onClick={commitPassage}
                      disabled={!input.trim()}
                      className="glow-neon border border-neon/60 px-5 py-2 text-sm tracking-wider text-neon transition-colors hover:bg-neon/10 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      PHÂN TÍCH ▸
                    </button>
                  </div>
                </section>
              )
            ) : (
              <section className="panel panel-accent hud-corners min-h-[19.375rem] space-y-4 px-5 py-5">
                <p className="glow-accent text-lg font-bold tracking-wider">✓ ĐÃ GỬI XONG ĐOẠN</p>
                {summary && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Stat label="CỤC BỘ TB" value={`${summary.avgLocal}%`} />
                    <Stat label="AI TB" value={summary.avgAI != null ? `${summary.avgAI}%` : '--'} />
                    <Stat label="WPM TB" value={summary.avgWpm ?? '--'} />
                    <Stat label="TỔNG LỖI" value={summary.totalErrors} />
                  </div>
                )}
                <button
                  onClick={resetPassage}
                  className="border border-neon/60 px-4 py-2 text-sm tracking-wider text-neon transition-colors hover:bg-neon/10"
                >
                  LÀM LẠI BÀI
                </button>
              </section>
            )}
          </div>

          <section className="space-y-2 lg:sticky lg:top-20">
            <div className="flex items-center justify-between gap-3">
              <p className="hud-label text-accent/80">PHÂN TÍCH</p>
              <span className="hud-label text-dim">{committed.length}/{total} CÂU</span>
            </div>
            <div className="panel panel-accent hud-corners h-[34rem] overflow-y-auto px-5 py-5 lg:h-[36rem]">
              {committed.length === 0 ? (
                <div className="flex h-full items-center justify-center px-5 text-center text-sm leading-relaxed text-dim">
                  Khung phân tích sẽ hiện ở đây sau khi bạn nhấn Enter.
                </div>
              ) : (
                <div className="space-y-3">
                  {committed.map((c) => (
                    <AnalysisCard key={c.key} item={c} onToggleRef={toggleRef} />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="border border-edge px-2 py-2 text-center">
      <div className="text-lg font-bold tabular-nums text-ink">{value}</div>
      <div className="hud-label text-dim">{label}</div>
    </div>
  )
}

function TypingWordPanel({ analysis, showHint }) {
  const hasWord = !!analysis.text
  const meaning = analysis.vocab?.meaning || ''
  const status = !hasWord
    ? { label: 'CHỜ GÕ', tone: 'text-dim', detail: showHint ? 'Bật gợi ý để nhìn bản dịch mờ và gõ theo nhịp của bạn.' : 'Bấm Gợi ý nếu muốn nhìn bản dịch tham chiếu dạng chữ mờ.' }
    : analysis.exact
      ? { label: 'KHỚP TỪ', tone: 'text-neon glow-neon', detail: meaning || (analysis.position ? `Có trong bản dịch tham chiếu, vị trí ${analysis.position}/${analysis.total}.` : 'Có trong bản dịch tham chiếu.') }
      : analysis.partial
        ? { label: 'ĐANG KHỚP', tone: 'text-accent glow-accent', detail: `Có thể là: ${analysis.suggestion}${meaning ? ` · ${meaning}` : ''}` }
        : { label: 'CHƯA THẤY', tone: 'text-amber-300', detail: 'Từ này chưa xuất hiện trong bản dịch tham chiếu còn lại.' }

  return (
    <div className="panel grid h-32 grid-cols-1 gap-2 overflow-hidden px-4 py-3 sm:h-24 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)]">
      <div className="min-w-0">
        <p className="hud-label text-dim">TỪ ĐANG GÕ</p>
        <p className="mt-1 truncate text-lg font-bold text-ink">{analysis.text || '-'}</p>
        <p className={`hud-label mt-1 ${status.tone}`}>{status.label}</p>
      </div>
      <div className="min-w-0 border-t border-edge/60 pt-2 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
        <p className="hud-label text-dim">PHÂN TÍCH NHANH</p>
        <p className="mt-1 max-h-10 overflow-hidden break-words text-sm text-dim">{status.detail}</p>
        {hasWord && analysis.expected && (
          <p className="mt-1 truncate text-xs text-neon/70">TỪ THEO VỊ TRÍ: <span className="text-ink">{analysis.expected}</span></p>
        )}
      </div>
    </div>
  )
}

function HintOverlay({ input, hintRemainder, analysis, scrollTop }) {
  const current = getTypingWord(input)
  const splitAt = current ? input.length - current.length : input.length
  const before = input.slice(0, splitAt)
  const tooltipMeaning = analysis.vocab?.meaning || 'Chưa có nghĩa riêng.'
  const boxRef = useRef(null)
  const wordRef = useRef(null)
  const tipRef = useRef(null)
  const [tipStyle, setTipStyle] = useState({ left: 0, top: 0, opacity: 0 })

  useLayoutEffect(() => {
    if (!current || !boxRef.current || !wordRef.current || !tipRef.current) {
      setTipStyle((s) => (s.opacity === 0 ? s : { ...s, opacity: 0 }))
      return
    }

    const box = boxRef.current.getBoundingClientRect()
    const word = wordRef.current.getBoundingClientRect()
    const tip = tipRef.current.getBoundingClientRect()
    const margin = 8
    let left = word.left - box.left + word.width / 2 - tip.width / 2
    let top = word.top - box.top - tip.height - margin

    left = Math.max(margin, Math.min(left, box.width - tip.width - margin))
    if (top < margin) top = word.bottom - box.top + margin
    if (top + tip.height > box.height - margin) top = Math.max(margin, box.height - tip.height - margin)

    setTipStyle({ left, top, opacity: 1 })
  }, [current, analysis.expected, tooltipMeaning, scrollTop, input])

  return (
    <div ref={boxRef} className="pointer-events-none absolute inset-3 z-20 overflow-hidden whitespace-pre-wrap px-6 pb-6 pt-16 font-mono text-lg leading-relaxed">
      {current ? (
        <span
          ref={tipRef}
          style={tipStyle}
          className="absolute w-44 border border-neon/40 bg-surface-2/95 px-3 py-2 text-left text-xs leading-snug text-ink shadow-[0_0_18px_rgba(45,226,255,0.12)]"
        >
          <span className="hud-label block truncate text-neon/70">{analysis.expected || 'GỢI Ý TỪ'}</span>
          <span className="mt-1 block truncate text-dim">{tooltipMeaning}</span>
        </span>
      ) : null}
      <div style={{ transform: `translateY(-${scrollTop || 0}px)` }}>
        <span className="text-transparent">{before}</span>
        {current ? (
          <span
            ref={wordRef}
            className={analysis.mismatch ? 'rounded-sm bg-red-500/20 text-red-300 underline decoration-red-300 decoration-wavy underline-offset-2' : 'text-transparent'}
          >
            {current}
          </span>
        ) : null}
        <span className="text-neon/20">{hintRemainder}</span>
      </div>
    </div>
  )
}

function AnalysisCard({ item: c, onToggleRef }) {
  return (
    <div className="panel space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="hud-label text-dim">CÂU {c.i + 1}</span>
        <span className="hud-label text-neon/70" title="Độ trùng từ với bản tham chiếu (chấm cục bộ)">CỤC BỘ {c.local?.similarity ?? 0}%</span>
        {c.aiStatus === 'pending' && <span className="hud-label status-dot text-accent">ĐANG PHÂN TÍCH...</span>}
        {c.aiStatus === 'done' && (
          <span className="hud-label text-accent">
            AI {c.ai?.score != null ? `${c.ai.score}%` : 'OK'}
            {c.ai?.errors?.length ? ` · ${c.ai.errors.length} LỖI` : ' · KHÔNG LỖI'}
          </span>
        )}
        {c.aiStatus === 'error' && <span className="hud-label text-accent" title={c.aiError}>AI LỖI</span>}
        {c.wpm != null && <span className="hud-label ml-auto text-dim">{c.wpm} WPM</span>}
      </div>

      <p className="whitespace-pre-wrap break-words leading-relaxed text-ink">
        {c.ai?.errors?.length ? renderUserText(c.userText, c.ai.errors) : renderLocalUserText(c.userText, c.local)}
      </p>

      {c.local?.similarity < 100 && (
        <div className="border-t border-edge/60 pt-2 text-sm leading-relaxed">
          <p className="hud-label mb-1 text-amber-200/80">CHƯA KHỚP 100%</p>
          <p className="text-neon/80">{renderReferenceDiff(c.local, c.reference)}</p>
        </div>
      )}

      {c.aiStatus === 'done' && c.ai?.errors?.length > 0 && (
        <ul className="space-y-1 border-t border-edge/60 pt-2 text-sm">
          {c.ai.errors.map((er, k) => {
            const meta = metaOf(er.type)
            return (
              <li key={k} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className={`border px-1.5 py-0.5 text-[10px] tracking-wider ${meta.border} ${meta.text}`}>{meta.label}</span>
                <span className={`${meta.text} break-words line-through decoration-1`}>{er.text}</span>
                {er.suggestion && <span className="break-words text-dim">→ <span className="text-ink not-italic">{er.suggestion}</span></span>}
                {er.note && <span className="w-full break-words text-dim">↳ {er.note}</span>}
              </li>
            )
          })}
        </ul>
      )}

      {c.aiStatus === 'done' && c.ai?.comment && (
        <p className="break-words text-sm italic text-dim">“{c.ai.comment}”</p>
      )}

      <button onClick={() => onToggleRef(c.key)} className="hud-label text-dim transition-colors hover:text-neon">
        {c.showRef ? 'ẨN THAM CHIẾU' : 'XEM THAM CHIẾU'}
      </button>
      {c.showRef && <p className="border-l-2 border-neon/40 pl-3 text-sm text-neon/80">{renderReferenceDiff(c.local, c.reference)}</p>}
    </div>
  )
}
