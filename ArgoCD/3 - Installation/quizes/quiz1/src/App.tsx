import { useState } from 'react'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import yaml from 'react-syntax-highlighter/dist/esm/languages/hljs/yaml'
import bash from 'react-syntax-highlighter/dist/esm/languages/hljs/bash'
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import './App.css'
import { questions } from './questions'
import type { Question } from './questions'

SyntaxHighlighter.registerLanguage('yaml', yaml)
SyntaxHighlighter.registerLanguage('bash', bash)

type GameState = 'lobby' | 'question' | 'reveal' | 'results'

const ANSWER_COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c', '#8b5cf6']
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E']

const ARGOCD_LOGO = 'https://raw.githubusercontent.com/cncf/artwork/master/projects/argo/icon/color/argo-icon-color.svg'
const K8S_LOGO    = 'https://raw.githubusercontent.com/cncf/artwork/master/projects/kubernetes/icon/color/kubernetes-icon-color.svg'
const GIT_LOGO    = 'https://raw.githubusercontent.com/gilbarbara/logos/main/logos/git-icon.svg'

function detectLang(code: string): string {
  if (code.includes('stage:') || code.includes('script:') || code.includes('helm ') || code.includes('kubectl ')) return 'yaml'
  return 'bash'
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('lobby')
  const [currentQ,  setCurrentQ]  = useState(0)
  const [selected,  setSelected]  = useState<number | null>(null)
  const [score,     setScore]     = useState(0)
  const [scoreGain, setScoreGain] = useState<number | null>(null)

  const question: Question = questions[currentQ]

  function startGame() {
    setCurrentQ(0); setScore(0); setScoreGain(null)
    setSelected(null); setGameState('question')
  }

  function handleAnswer(idx: number) {
    if (gameState === 'reveal') return
    setSelected(idx)
    if (idx === question.correct) {
      setScore(s => s + 1)
      setScoreGain(1)
    } else {
      setScoreGain(null)
    }
    setGameState('reveal')
  }

  function nextQuestion() {
    if (currentQ + 1 >= questions.length) {
      setGameState('results')
    } else {
      setCurrentQ(q => q + 1)
      setSelected(null); setScoreGain(null); setGameState('question')
    }
  }

  if (gameState === 'lobby')   return <Lobby onStart={startGame} />
  if (gameState === 'results') return <Results score={score} total={questions.length} onRestart={startGame} />

  const optCount = question.options.length

  return (
    <div className="quiz-screen">
      <header className="quiz-header">
        <div className="q-counter">
          <img src={ARGOCD_LOGO} alt="Argo" className="header-logo" />
          <span className="quiz-label">Quiz 1</span>
          <span className="q-sep">·</span>
          Question {currentQ + 1} of {questions.length}
        </div>
        <div className="score-pill">Score: {score} / {questions.length}</div>
      </header>

      <div className="progress-bar-wrap">
        <div className="progress-bar-fill" style={{ width: `${((currentQ) / questions.length) * 100}%` }} />
      </div>

      <div className="question-card">
        <p className="question-text">{question.question}</p>
        {question.code && (
          <div className="code-wrap">
            <div className="code-titlebar">
              <span className="dot red" /><span className="dot yellow" /><span className="dot green" />
              <span className="code-lang">{detectLang(question.code).toUpperCase()}</span>
            </div>
            <SyntaxHighlighter
              language={detectLang(question.code)}
              style={atomOneDark}
              customStyle={{
                margin: 0,
                padding: '16px 20px',
                fontSize: 'clamp(11px, 1.3vw, 13px)',
                lineHeight: '1.65',
                borderRadius: '0 0 10px 10px',
                background: '#0d1117',
                maxHeight: '240px',
                overflowY: 'auto',
              }}
            >
              {question.code}
            </SyntaxHighlighter>
          </div>
        )}
      </div>

      <p className="select-hint">Select the best answer:</p>

      <div className={`answers-grid answers-${optCount}`}>
        {question.options.map((opt, i) => {
          let cls = 'answer-btn'
          if (gameState === 'reveal') {
            if (i === question.correct) cls += ' correct'
            else if (selected === i)   cls += ' wrong'
            else                       cls += ' dim'
          }
          const isLast = i === optCount - 1
          const isOdd  = optCount % 2 !== 0
          return (
            <button
              key={i}
              className={cls + (isLast && isOdd ? ' span-full' : '')}
              style={{ '--c': ANSWER_COLORS[i] } as React.CSSProperties}
              onClick={() => handleAnswer(i)}
              disabled={gameState === 'reveal'}
            >
              <span className="a-label">{OPTION_LABELS[i]}</span>
              <span className="a-text">{opt}</span>
            </button>
          )
        })}
      </div>

      {gameState === 'reveal' && (
        <div className={`reveal-bar ${selected === question.correct ? 'reveal-correct' : 'reveal-wrong'}`}>
          <div className="reveal-left">
            <span className="reveal-emoji">
              {selected === question.correct ? '✅' : '❌'}
            </span>
            <div>
              <strong>{selected === question.correct ? 'Correct!' : 'Incorrect'}</strong>
              {scoreGain !== null && <span className="gain-badge">+1</span>}
              {question.explanation && <p className="explanation">{question.explanation}</p>}
            </div>
          </div>
          <button className="next-btn" onClick={nextQuestion}>
            {currentQ + 1 >= questions.length ? 'See Results 🏁' : 'Next →'}
          </button>
        </div>
      )}
    </div>
  )
}

function Lobby({ onStart }: { onStart: () => void }) {
  return (
    <div className="lobby">
      <div className="lobby-logos">
        <img src={GIT_LOGO}    alt="Git"        className="tech-logo" />
        <img src={ARGOCD_LOGO} alt="ArgoCD"     className="main-logo" />
        <img src={K8S_LOGO}    alt="Kubernetes" className="tech-logo" />
      </div>
      <div className="quiz-number-badge">Quiz 1</div>
      <h1 className="lobby-title">Traditional CI/CD Challenges</h1>
      <p className="lobby-sub">ArgoCD Series · Understanding Push-Based Deployment Problems</p>
      <div className="badge-row">
        <span className="badge">Config Drift</span>
        <span className="badge">Auditability</span>
        <span className="badge">CI/CD Push</span>
        <span className="badge">Rollbacks</span>
      </div>
      <button className="start-btn" onClick={onStart}>Begin Assessment</button>
      <p className="q-info">{questions.length} questions · No time limit · 1 point each</p>
    </div>
  )
}

function Results({ score, total, onRestart }: { score: number; total: number; onRestart: () => void }) {
  const pct   = Math.round((score / total) * 100)
  const medal = pct >= 80 ? '🏆' : pct >= 50 ? '🥈' : '📚'
  const label = pct >= 80 ? 'ArgoCD Expert!' : pct >= 60 ? 'Proficient' : pct >= 40 ? 'Developing' : 'Needs Review'
  const grade = pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : pct >= 50 ? 'D' : 'F'

  return (
    <div className="results">
      <img src={ARGOCD_LOGO} alt="ArgoCD" className="result-logo" />
      <div className="result-medal">{medal}</div>
      <h1>Assessment Complete</h1>
      <div className="grade-badge">{grade}</div>
      <div className="final-score">
        {score}<span className="max-score"> / {total} correct</span>
      </div>
      <div className="score-bar-wrap">
        <div className="score-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="score-pct">{pct}% — {label}</p>
      <button className="start-btn" onClick={onRestart}>Retake Assessment</button>
    </div>
  )
}
