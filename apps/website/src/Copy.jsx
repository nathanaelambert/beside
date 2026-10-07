import React, { useCallback } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { BookOpen, Check, FileText, MousePointerClick, RotateCcw, Sparkles, Undo2, X } from 'lucide-react'
import { BALANCE, DECOR, REPLIES, SPOTS, TEMPLATES } from './content.js'
import { Sprite } from './sprites.jsx'

const EASE = [0.2, 0.8, 0.2, 1]

const group = {
  enter: {},
  center: { transition: { staggerChildren: 0.07, delayChildren: 0.08 } },
  exit: { transition: { staggerChildren: 0.025 } },
}
const rise = {
  enter: (d) => ({ y: d >= 0 ? '110%' : '-110%', opacity: 0 }),
  center: { y: '0%', opacity: 1, transition: { duration: 0.8, ease: EASE } },
  exit: (d) => ({ y: d >= 0 ? '-110%' : '110%', opacity: 0, transition: { duration: 0.32, ease: [0.6, 0, 0.8, 0.2] } }),
}
const fade = {
  enter: (d) => ({ y: d >= 0 ? 24 : -24, opacity: 0 }),
  center: { y: 0, opacity: 1, transition: { duration: 0.7, ease: EASE } },
  exit: (d) => ({ y: d >= 0 ? -16 : 16, opacity: 0, transition: { duration: 0.25 } }),
}

function Demo({ id, state, actions }) {
  switch (id) {
    case 'world':
      return (
        <div className="demo">
          <p className="explore"><MousePointerClick size={16} /><span>Tap <b>Reading</b>, <b>Moving</b> or <b>Cooking</b> in the world to look inside.</span></p>
          <p className="aside">Other spaces stay separate, for example <i>Thursday readers</i> (four friends) or <i>The cousins</i> (three).</p>
        </div>
      )
    case 'pace':
      return (
        <ul className="templates" aria-label="Activity templates">
          {TEMPLATES.map((t) => <li key={t}>{t}</li>)}
        </ul>
      )
    case 'notes':
      return (
        <div className="demo">
          <span className="tag">Illustrative demo</span>
          <div className="demo-row">
            <button type="button" className="btn primary" onClick={actions.logChapter} disabled={state.noteOpen}>
              {state.noteOpen ? <><Check size={16} /> Chapter 4 logged</> : <><BookOpen size={16} /> Log chapter 4</>}
            </button>
            {state.noteOpen && (
              <button type="button" className="btn ghost" onClick={actions.resetNote}>
                <RotateCcw size={15} /> Reset
              </button>
            )}
          </div>
          <AnimatePresence initial={false}>
            {state.noteOpen && (
              <motion.div
                className="replies"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto', transition: { delay: 0.35, duration: 0.45, ease: EASE } }}
                exit={{ opacity: 0, height: 0 }}
              >
                <p className="replies-label" id="reply-label">Leave a reply for Noor</p>
                <div className="reply-options" role="group" aria-labelledby="reply-label">
                  {REPLIES.map((r, n) => (
                    <button key={r} type="button" className="option" aria-pressed={state.reply === n} onClick={() => actions.reply(n)}>
                      {r}
                    </button>
                  ))}
                </div>
                <p className="demo-note" aria-live="polite">
                  {state.reply !== null && 'Kept on this page only. In beside, Noor would find it the next time she opens your space.'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )
    case 'grow': {
      const left = BALANCE - state.spent
      const full = state.decor.length >= SPOTS.length
      const choosing = DECOR.find((d) => d.id === state.choosing)
      return (
        <div className="demo">
          <span className="tag">Illustrative demo · {left} seeds to spend</span>
          <div className="decor-options" role="group" aria-label="Choose a decoration">
            {DECOR.map((d) => (
              <button
                key={d.id}
                type="button"
                className="decor-option"
                aria-pressed={state.choosing === d.id}
                disabled={full || d.cost > left}
                onClick={() => actions.choose(d.id)}
              >
                <span className="decor-icon"><Sprite kind={d.id} /></span>
                <span className="decor-name">{d.name}</span>
                <span className="decor-cost">{d.cost}</span>
              </button>
            ))}
          </div>
          <div className="demo-row">
            {choosing && (
              <button type="button" className="btn ghost" onClick={() => actions.choose(null)}>
                <X size={15} /> Cancel
              </button>
            )}
            {state.decor.length > 0 && !choosing && (
              <button type="button" className="btn ghost" onClick={actions.removeLast}>
                <Undo2 size={15} /> Remove last
              </button>
            )}
          </div>
          <p className="demo-note" aria-live="polite">
            {choosing
              ? `Now tap a glowing spot in the garden to place the ${choosing.name.toLowerCase()}.`
              : full || left < 20
                ? 'Spent well. What you place stays, season after season.'
                : state.decor.length
                  ? 'Placed for good. Add another, or keep the rest for later.'
                  : 'Pick something to add, then choose where it goes.'}
          </p>
        </div>
      )
    }
    case 'keep': {
      const traces = [
        state.reply !== null && `A reply for Noor, waiting at chapter 4`,
        ...state.decor.map((d) => `${d.kind === 'flowers' ? 'Flowers' : `A ${DECOR.find((k) => k.id === d.kind).name.toLowerCase()}`} ${SPOTS[d.spot].label}`),
      ].filter(Boolean)
      return (
        <div className="closing">
          {traces.length > 0 && (
            <div className="traces">
              <p className="eyebrow">Your visit left</p>
              <ul>{traces.map((t) => <li key={t}><Sparkles size={13} /> {t}</li>)}</ul>
            </div>
          )}
          <p className="eyebrow">A project taking shape</p>
          <p>
            Beside is a concept and design in progress, not an app you can download yet. If you’d like to help build it, the
            project notes cover the idea and where contributions would matter most.
          </p>
          <div className="demo-row">
            <button type="button" className="btn primary" onClick={actions.openNotes}>
              <FileText size={16} /> Project notes
            </button>
            <button type="button" className="btn ghost" onClick={actions.replay}>
              <RotateCcw size={15} /> Replay
            </button>
          </div>
        </div>
      )
    }
    default:
      return null
  }
}

export default function Copy({ chapter, index, dir, state, actions }) {
  const resetScrollOnMount = useCallback((element) => {
    const panel = element?.closest('.copy')
    if (panel) panel.scrollTop = 0
  }, [])
  return (
    <AnimatePresence mode="wait" custom={dir} initial={false}>
      <motion.article ref={resetScrollOnMount} key={chapter.id} className="copy-inner" custom={dir} variants={group} initial="enter" animate="center" exit="exit">
        <motion.p className="kicker" custom={dir} variants={fade}>
          <span className="kicker-num">{String(index + 1).padStart(2, '0')}</span>
          {chapter.kicker}
        </motion.p>
        <h1 className="title">
          {chapter.title.map((line) => (
            <span className="line" key={line}>
              <motion.span custom={dir} variants={rise}>{line}</motion.span>
            </span>
          ))}
        </h1>
        {chapter.body.map((p) => (
          <motion.p key={p} className="body" custom={dir} variants={fade}>{p}</motion.p>
        ))}
        {chapter.lede && <motion.p className="lede" custom={dir} variants={fade}>{chapter.lede}</motion.p>}
        <motion.div custom={dir} variants={fade}>
          <Demo id={chapter.id} state={state} actions={actions} />
        </motion.div>
      </motion.article>
    </AnimatePresence>
  )
}
