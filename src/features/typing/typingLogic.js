import { normalize, shuffle } from '../../lib/util.js'

export function isUsableTypingWord(word) {
  return Boolean(word?.id && String(word.term || '').trim() && String(word.meaning || '').trim())
}

export function selectTypingWords(words, { topic = 'all', onlyUnlearned = false, count = 'all' } = {}) {
  const filtered = words.filter((word) => {
    if (!isUsableTypingWord(word)) return false
    if (topic !== 'all' && word.topic !== topic) return false
    if (onlyUnlearned && word.learned) return false
    return true
  })
  const limit = count === 'all' ? filtered.length : Number(count) || filtered.length
  return shuffle(filtered).slice(0, Math.max(0, limit))
}

export function isTypingAnswerCorrect(word, input) {
  return normalize(input) === normalize(word?.term || '')
}

export function canCheckWithSpace(word) {
  return !/\s/.test(normalize(word?.term || ''))
}

export function advanceTypingSession(state, input) {
  const current = state.queue[0]
  if (!current) return { ...state, status: 'done' }

  const correct = isTypingAnswerCorrect(current, input)
  const remaining = state.queue.slice(1)
  const retryQueue = correct ? state.retryQueue : [...state.retryQueue, current]
  const completedIds = correct ? [...state.completedIds, current.id] : state.completedIds
  const attempts = state.attempts + 1
  const wrongAttempts = correct ? state.wrongAttempts : state.wrongAttempts + 1
  const last = {
    word: current,
    input: String(input || '').trim(),
    correct,
    round: state.round,
  }

  if (remaining.length > 0) {
    return { ...state, queue: remaining, retryQueue, completedIds, attempts, wrongAttempts, last }
  }

  if (retryQueue.length > 0) {
    return {
      ...state,
      queue: retryQueue,
      retryQueue: [],
      completedIds,
      attempts,
      wrongAttempts,
      last,
      round: state.round + 1,
    }
  }

  return {
    ...state,
    queue: [],
    retryQueue: [],
    completedIds,
    attempts,
    wrongAttempts,
    last,
    status: 'done',
  }
}
