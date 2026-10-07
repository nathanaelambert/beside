import React, { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { X } from 'lucide-react'

const AREAS = [
  ['Interaction & product design', 'Flows for shared activities, notes, choosing who sees what.'],
  ['Pixel art & world-building', 'Decorations, seasons, avatars and keepsake objects.'],
  ['Mobile engineering', 'A calm, quick app for logging progress in seconds.'],
  ['Sync, privacy & data', 'Async-first sharing between small private spaces.'],
  ['Activity templates & writing', 'Books, habits, cooking, travel and custom activities.'],
  ['Research', 'Conversations with friends who live far apart.'],
]

export default function Notes({ onClose }) {
  const closeRef = useRef(null)
  const panelRef = useRef(null)

  useEffect(() => {
    const opener = document.activeElement
    closeRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab') {
        const items = panelRef.current.querySelectorAll('button, a[href], [tabindex="0"]')
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
  }, [onClose])

  return (
    <motion.div className="notes-backdrop" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.aside
        ref={panelRef}
        className="notes"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notes-title"
        onClick={(e) => e.stopPropagation()}
        initial={{ x: '100%' }}
        animate={{ x: 0, transition: { type: 'spring', stiffness: 220, damping: 30 } }}
        exit={{ x: '100%', transition: { duration: 0.25 } }}
      >
        <header className="notes-head">
          <p className="eyebrow">For contributors</p>
          <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label="Close project notes">
            <X size={18} />
          </button>
        </header>
        <div className="notes-body" tabIndex={0}>
          <h2 id="notes-title">Project notes</h2>
          <p>
            Beside is a concept for a private shared space between people who are already close. Each connection, two friends
            or a small group, gets one illustrated world where shared activities live together: a book, a habit, recipes, a
            trip. Everyone moves at their own pace; progress and notes shape the world over time, and finished experiences
            become keepsakes.
          </p>
          <h3>Where it stands</h3>
          <p>Concept and design exploration. There is no app or sign-up yet, and every scene on this page is illustrative.</p>
          <h3>Principles</h3>
          <ul className="principles">
            <li>Existing friendships and shared intentions come first.</li>
            <li>Async first. Nobody needs to be online together.</li>
            <li>Mutual participation earns more. Goals and optional streaks fit each activity.</li>
            <li>Personal logs stay optional, and you choose each audience.</li>
          </ul>
          <h3>Where help would matter</h3>
          <dl className="areas">
            {AREAS.map(([t, d]) => (
              <div key={t}>
                <dt>{t}</dt>
                <dd>{d}</dd>
              </div>
            ))}
          </dl>
          <h3>Getting involved</h3>
          <p>If someone shared this page with you, reply to them directly. That’s the way in for now.</p>
        </div>
      </motion.aside>
    </motion.div>
  )
}
