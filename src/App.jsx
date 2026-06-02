import { useState } from 'react'
import TranslatePractice from './features/translate/TranslatePractice'
import Flashcards from './features/flashcards/Flashcards'
import Quiz from './features/quiz/Quiz'
import LessonManager from './features/lessons/LessonManager'
import VocabularyTyping from './features/typing/VocabularyTyping'
import Vocabulary from './features/vocabulary/Vocabulary'
import DataManager from './components/DataManager'
import Settings from './features/settings/Settings'

const TABS = [
  { id: 'translate', label: 'DỊCH', Comp: TranslatePractice },
  { id: 'lessons', label: 'BÀI HỌC', Comp: LessonManager },
  { id: 'flashcards', label: 'FLASHCARD', Comp: Flashcards },
  { id: 'quiz', label: 'QUIZ', Comp: Quiz },
  { id: 'typing', label: 'GÕ TỪ', Comp: VocabularyTyping },
  { id: 'vocabulary', label: 'TỪ VỰNG', Comp: Vocabulary },
  { id: 'settings', label: 'CẤU HÌNH', Comp: Settings },
]

export default function App() {
  const [tab, setTab] = useState('translate')
  const Active = (TABS.find((t) => t.id === tab) || TABS[0]).Comp

  return (
    <div className="min-h-screen">
      <nav className="panel sticky top-0 z-40 flex min-w-0 flex-wrap items-center gap-3 px-3 py-2 backdrop-blur-sm sm:px-4">
        <span className="glow-neon hidden text-sm font-bold tracking-[0.3em] sm:inline">◈ LEARN·EN</span>
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-xs tracking-wider transition-colors ${
                tab === t.id ? 'bg-neon/15 text-neon glow-neon' : 'text-dim hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="ml-auto min-w-0">
          <DataManager />
        </div>
      </nav>
      <Active />
    </div>
  )
}
