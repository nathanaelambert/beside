import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { ArrowDown, ArrowLeft, ArrowRight, FileText, Pause, Play } from 'lucide-react'
import { BALANCE, CHAPTERS, DECOR, REPLIES, SPOTS } from './content.js'
import Stage from './Stage.jsx'
import Copy from './Copy.jsx'
import Notes from './Notes.jsx'
import './style.css'

const LAST = CHAPTERS.length - 1
const PANELS = '.keepsake-body, .notes-body, .note-stack, .preview'
const pad = (n) => String(n).padStart(2, '0')
const keepsakeDefault = () => !window.matchMedia('(max-width: 820px)').matches

function canScroll(target, delta) {
  for (let el = target; el && el !== document.body; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el)
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
      if (delta > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return true
    }
  }
  return false
}

function App() {
  const [motionOn, setMotionOn] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [[index, dir], setNav] = useState([0, 1])
  const [activity, setActivity] = useState(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [reply, setReply] = useState(null)
  const [decor, setDecor] = useState([])
  const [choosing, setChoosing] = useState(null)
  const [keepsakeOpen, setKeepsakeOpen] = useState(keepsakeDefault)
  const [notesPanel, setNotesPanel] = useState(false)
  const panelRef = useRef(false)
  panelRef.current = notesPanel
  const choosingRef = useRef(null)
  choosingRef.current = choosing
  const escRef = useRef(null)
  escRef.current = () => {
    if (index === 4 && choosing) setChoosing(null)
    else if (index === 1 && activity) setActivity(null)
    else if (index === LAST && keepsakeOpen) setKeepsakeOpen(false)
  }
  const spent = decor.reduce((sum, d) => sum + DECOR.find((k) => k.id === d.kind).cost, 0)

  const go = useCallback((target) => {
    setNav(([i, d]) => {
      const t = Math.max(0, Math.min(LAST, target))
      return t === i ? [i, d] : [t, t > i ? 1 : -1]
    })
  }, [])
  const step = useCallback((d) => setNav(([i, pd]) => {
    const t = Math.max(0, Math.min(LAST, i + d))
    return t === i ? [i, pd] : [t, d]
  }), [])

  const closeNotes = useCallback(() => setNotesPanel(false), [])
  const actions = useMemo(() => ({
    pickActivity: setActivity,
    logChapter: () => setNoteOpen(true),
    resetNote: () => { setNoteOpen(false); setReply(null) },
    reply: setReply,
    choose: (kind) => setChoosing((c) => (c === kind ? null : kind)),
    place: (spot) => {
      const kind = choosingRef.current
      if (!kind) return
      setDecor((prev) => {
        const cost = prev.reduce((s, d) => s + DECOR.find((k) => k.id === d.kind).cost, 0)
        const price = DECOR.find((k) => k.id === kind).cost
        if (prev.length >= SPOTS.length || prev.some((d) => d.spot === spot) || cost + price > BALANCE) return prev
        return [...prev, { spot, kind }]
      })
      setChoosing(null)
    },
    removeLast: () => setDecor((prev) => prev.slice(0, -1)),
    toggleKeepsake: () => setKeepsakeOpen((o) => !o),
    openNotes: () => setNotesPanel(true),
    replay: () => {
      setActivity(null)
      setNoteOpen(false)
      setReply(null)
      setDecor([])
      setChoosing(null)
      setKeepsakeOpen(keepsakeDefault())
      go(0)
    },
  }), [go])

  useEffect(() => {
    let lastWheel = 0
    let lastNav = 0
    let acc = 0
    let used = false
    const onWheel = (e) => {
      if (panelRef.current || e.ctrlKey) return
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (canScroll(e.target, delta)) return
      const panel = e.target.closest?.(PANELS)
      if (panel) return
      e.preventDefault()
      const now = performance.now()
      if (now - lastWheel > 220) { used = false; acc = 0 }
      lastWheel = now
      if (used || now - lastNav < 700) return
      acc += delta
      if (Math.abs(acc) > 30) {
        step(acc > 0 ? 1 : -1)
        used = true
        lastNav = now
        acc = 0
      }
    }
    const onKey = (e) => {
      if (panelRef.current || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape') { escRef.current(); return }
      const t = e.target
      if (t.closest?.('input, textarea, select, [contenteditable="true"]')) return
      if (t.closest?.(PANELS)) return
      const onControl = t.closest?.('button, a')
      const map = {
        ArrowDown: 1, ArrowRight: 1, PageDown: 1, ArrowUp: -1, ArrowLeft: -1, PageUp: -1,
        ' ': onControl ? 0 : e.shiftKey ? -1 : 1,
      }
      if (e.key === 'Home') { e.preventDefault(); go(0) }
      else if (e.key === 'End') { e.preventDefault(); go(LAST) }
      else if (map[e.key]) { e.preventDefault(); step(map[e.key]) }
    }
    let start = null
    const onTouchStart = (e) => {
      const p = e.touches[0]
      start = { x: p.clientX, y: p.clientY, stage: !!e.target.closest('.stage'), target: e.target }
    }
    const onTouchEnd = (e) => {
      if (!start || panelRef.current) return
      const p = e.changedTouches[0]
      const dx = p.clientX - start.x
      const dy = p.clientY - start.y
      if (start.target.closest?.(PANELS)) { start = null; return }
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.3) step(dx < 0 ? 1 : -1)
      else if (start.stage && Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx)) step(dy < 0 ? 1 : -1)
      start = null
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [go, step])

  const chapter = CHAPTERS[index]
  const { bg, ink, accent, stage } = chapter.palette
  const state = {
    activity, noteOpen, reply, replyText: reply === null ? null : REPLIES[reply], decor, spent, choosing, keepsakeOpen,
  }

  return (
    <MotionConfig reducedMotion={motionOn ? 'never' : 'always'}>
      <div
        className="shell"
        data-tone={chapter.dark ? 'dark' : 'light'}
        data-motion={motionOn ? 'on' : 'off'}
        style={{ '--bg': bg, '--ink': ink, '--accent': accent, '--stage': stage }}
      >
        <header className="top">
          <button type="button" className="wordmark" onClick={() => go(0)} aria-label="beside, back to the start">
            beside<span aria-hidden="true">.</span>
          </button>
          <nav aria-label="Chapters">
            <ol className="chapters">
              {CHAPTERS.map((c, i) => (
                <li key={c.id}>
                  <button type="button" aria-label={`Chapter ${i + 1}: ${c.nav}`} aria-current={i === index ? 'step' : undefined} onClick={() => go(i)}>
                    <span className="num">{pad(i + 1)}</span>
                    <span className="lbl">{c.nav}</span>
                    {i === index && <motion.span layoutId="chapter-pill" className="pill" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
          <div className="tools">
            <button type="button" className="tool" aria-pressed={!motionOn} onClick={() => setMotionOn((m) => !m)}>
              {motionOn ? <Pause size={15} /> : <Play size={15} />}
              <span>{motionOn ? 'Reduce motion' : 'Motion off'}</span>
            </button>
            <button type="button" className="tool" onClick={actions.openNotes}>
              <FileText size={15} /> <span>Project notes</span>
            </button>
          </div>
        </header>

        <main className="halves">
          <section className="copy" aria-label={`Chapter ${index + 1} of ${CHAPTERS.length}`}>
            <Copy chapter={chapter} index={index} dir={dir} state={state} actions={actions} />
          </section>
          <Stage index={index} calm={!motionOn} state={state} actions={actions} />
        </main>

        <footer className="bottom">
          <div className="pager">
            <button type="button" className="round" onClick={() => step(-1)} disabled={index === 0} aria-label="Previous chapter">
              <ArrowLeft size={18} />
            </button>
            <span className="count" aria-hidden="true">
              {pad(index + 1)} <i>/</i> {pad(CHAPTERS.length)}
            </span>
            <button type="button" className="round" onClick={() => step(1)} disabled={index === LAST} aria-label="Next chapter">
              <ArrowRight size={18} />
            </button>
          </div>
          <div className="progress" aria-hidden="true">
            <motion.span initial={false} animate={{ scaleX: (index + 1) / CHAPTERS.length }} transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }} />
          </div>
          <p className="hint">
            {index < LAST ? <><ArrowDown size={14} className="nudge" /> Scroll, swipe or use the arrow keys</> : 'The end, for now.'}
          </p>
        </footer>

        <p className="sr-only" aria-live="polite">{`Chapter ${index + 1} of ${CHAPTERS.length}: ${chapter.nav}`}</p>

        <AnimatePresence>{notesPanel && <Notes onClose={closeNotes} />}</AnimatePresence>
      </div>
    </MotionConfig>
  )
}

createRoot(document.getElementById('root')).render(<App />)
