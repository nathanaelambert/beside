import React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { BookOpen, ChevronDown, Footprints, Lock, Mail, Utensils, X } from 'lucide-react'
import { ACTIVITIES, BALANCE, CAMS, DECOR, SPOTS } from './content.js'
import { Sprite } from './sprites.jsx'

const EASE = [0.2, 0.8, 0.2, 1]
const ALT =
  'Pixel-art garden world shared by two friends: a vine-covered cottage, bookshelves, lanterns, a lily pond and a wooden bridge. One friend reads at a table on the patio while the other stretches on a yoga mat on the lawn.'
const ICONS = { reading: BookOpen, moving: Footprints, cooking: Utensils }
const decorOf = (id) => DECOR.find((d) => d.id === id)

const at = (cam, x, y) => ({
  left: `${50 + cam.s * (x - cam.x)}%`,
  top: `${50 + cam.s * (y - cam.y)}%`,
})

export function cameraFor(index, activity) {
  const base = CAMS[index]
  const a = index === 1 && ACTIVITIES.find((x) => x.id === activity)
  return a ? { ...base, ...a.cam } : base
}

function Pop({ i = 0, className, style, children, ...rest }) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: { delay: 0.55 + i * 0.12, duration: 0.6, ease: EASE } }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

const Avatar = ({ who }) => <span className={`avatar ${who}`} aria-hidden="true">{who === 'you' ? 'Y' : 'N'}</span>

const GLOWS = [
  { x: 9, y: 40 },
  { x: 19, y: 56 },
  { x: 32, y: 36 },
  { x: 43, y: 38 },
  { x: 50, y: 57 },
  { x: 62, y: 68 },
]
const MOTES = [
  [12, 30, 0], [24, 70, 3], [38, 18, 6], [52, 82, 1.5], [63, 40, 4.5], [74, 66, 2], [86, 24, 5], [91, 58, 7], [30, 48, 8.5], [70, 12, 9.5],
]

function Plans({ index, cam, activity, onPick }) {
  const live = index === 1
  const world = live ? cam : CAMS[1]
  return ACTIVITIES.map((a, i) => {
    const Icon = ICONS[a.id]
    const pos = index === 0 ? { left: `${a.from.left}%`, top: `${a.from.top}%` } : at(world, a.x, a.y)
    const on = live && activity === a.id
    return (
      <motion.button
        key={a.id}
        type="button"
        className={`plan ${index === 0 ? 'loose' : 'home'} ${on ? 'on' : ''}`}
        data-live={live}
        disabled={!live}
        aria-hidden={!live}
        aria-pressed={live ? on : undefined}
        aria-controls={live ? 'activity-preview' : undefined}
        aria-label={live ? `${a.label}: ${on ? 'hide' : 'look inside'}` : undefined}
        onClick={() => onPick(on ? null : a.id)}
        initial={false}
        animate={{
          ...pos,
          rotate: index === 0 ? a.from.r : 0,
          opacity: index <= 1 ? 1 : 0,
        }}
        transition={{
          type: 'spring', stiffness: 55, damping: 15, mass: 1,
          delay: index === 1 ? 0.15 + i * 0.12 : 0,
          opacity: { duration: 0.4, delay: index <= 1 ? 0.3 + i * 0.1 : 0 },
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {index === 0 ? (
            <motion.span key="plan" className="plan-text" exit={{ opacity: 0, transition: { duration: 0.2 } }}>{a.plan}</motion.span>
          ) : (
            <motion.span key="home" className="plan-home" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.6 } }}>
              <Icon size={14} /> {a.label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    )
  })
}

function Preview({ id, onClose }) {
  const Icon = ICONS[id]
  const body = {
    reading: (
      <>
        <p className="pv-title">The Lantern House</p>
        {[['you', 'You', 3], ['noor', 'Noor', 4]].map(([who, name, ch]) => (
          <div className="pv-row" key={who}>
            <Avatar who={who} /> <span>{name}</span>
            <span className="pv-bar"><i style={{ width: `${(ch / 12) * 100}%` }} className={who} /></span>
            <small>ch. {ch}</small>
          </div>
        ))}
        <p className="pv-foot"><Lock size={12} /> One sealed note waits at chapter 4</p>
      </>
    ),
    moving: (
      <>
        <p className="pv-title">Morning stretch</p>
        {[['you', 'You', [1, 0, 0, 1, 0, 0, 0]], ['noor', 'Noor', [1, 1, 0, 0, 1, 0, 0]]].map(([who, name, days]) => (
          <div className="pv-row" key={who}>
            <Avatar who={who} /> <span>{name}</span>
            <span className="pv-days">{days.map((d, n) => <i key={n} className={d ? who : ''} />)}</span>
          </div>
        ))}
        <p className="pv-foot">Different goals, one shared habit. Streaks are optional.</p>
      </>
    ),
    cooking: (
      <>
        <p className="pv-title">Recipes to try</p>
        <ul className="pv-list">
          <li><Avatar who="noor" /> <span><b>Nani’s dal</b> Noor cooked it Sunday and left a photo</span></li>
          <li><Avatar who="you" /> <span><b>Lemon olive-oil cake</b> saved for when you visit</span></li>
        </ul>
      </>
    ),
  }[id]
  return (
    <motion.div
      id="activity-preview"
      className="preview"
      role="region"
      aria-label={`${id} preview`}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE, delay: 0.15 } }}
      exit={{ opacity: 0, y: 10, transition: { duration: 0.18 } }}
    >
      <div className="pv-head">
        <span className="pv-kicker"><Icon size={14} /> {id[0].toUpperCase() + id.slice(1)} · Noor &amp; you</span>
        <button type="button" className="pv-close" onClick={onClose} aria-label="Close preview"><X size={16} /></button>
      </div>
      {body}
    </motion.div>
  )
}

function Overlay({ index, cam, state, actions }) {
  switch (index) {
    case 0:
      return (
        <Pop className="chat" aria-hidden="true">
          <div className="chat-head">
            <Avatar who="noor" /> <b>Noor</b>
          </div>
          <div className="chat-scroll">
            <div className="chat-drift">
              <span className="stamp">March 2</span>
              <p className="msg them buried">we should read that book together</p>
              <p className="msg me">yes!! once the move is done</p>
              <p className="msg them buried">also: cook Nani’s dal over video?</p>
              <span className="stamp">212 messages later</span>
              <p className="msg them photo" />
              <p className="msg me buried">sunday stretch call? for real this time</p>
              <p className="msg them">how did the interview go?</p>
              <p className="msg me last">wait, what was the book called?</p>
            </div>
          </div>
        </Pop>
      )
    case 1:
      return (
        <>
          <Pop className="chip private" style={{ left: '4%', top: '4%' }}>
            <Lock size={14} /> Noor &amp; you · private
          </Pop>
          <AnimatePresence mode="wait">
            {state.activity && <Preview key={state.activity} id={state.activity} onClose={() => actions.pickActivity(null)} />}
          </AnimatePresence>
        </>
      )
    case 2:
      return (
        <>
          <Pop className="card progress-card" style={at(cam, 27, 37)}>
            <div className="who"><Avatar who="you" /> You</div>
            <strong>Chapter 3</strong>
            <small>Your goal: a chapter a week</small>
          </Pop>
          <Pop i={1} className="card progress-card" style={at(cam, 74, 36)}>
            <div className="who"><Avatar who="noor" /> Noor</div>
            <strong>Chapter 4</strong>
            <small>Her goal: weekend mornings, plus a stretch habit</small>
          </Pop>
          <Pop i={2} className="track">
            <div className="track-title"><BookOpen size={14} /> The Lantern House · shared</div>
            <div className="track-line">
              {Array.from({ length: 12 }, (_, n) => <i key={n} className={n < 4 ? 'done' : ''} />)}
              <span className="track-mark you" style={{ left: `${(2.5 / 12) * 100}%` }}><Avatar who="you" /></span>
              <span className="track-mark noor" style={{ left: `${(3.5 / 12) * 100}%` }}><Avatar who="noor" /></span>
            </div>
          </Pop>
        </>
      )
    case 3:
      return (
        <>
          <Pop className="tag demo-tag" style={{ left: '4%', top: '4%' }}>Illustrative demo</Pop>
          <Pop i={1} className={`marker ${state.noteOpen ? 'opened' : ''}`} style={at(cam, 27, 36)}>
            <Mail size={16} />
          </Pop>
          <div className="note-stack" tabIndex={state.noteOpen ? 0 : undefined} aria-label={state.noteOpen ? 'Note and reply' : undefined} role={state.noteOpen ? 'region' : undefined}>
            <AnimatePresence mode="popLayout">
              {state.noteOpen ? (
                <motion.figure
                  key="open"
                  className="note"
                  role="status"
                  initial={{ opacity: 0, scale: 0.85, rotate: -4, y: 16 }}
                  animate={{ opacity: 1, scale: 1, rotate: -1.5, y: 0, transition: { type: 'spring', stiffness: 160, damping: 16 } }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <blockquote>“Did that change how you saw the narrator?”</blockquote>
                  <figcaption><Avatar who="noor" /> Noor · left at chapter 4</figcaption>
                </motion.figure>
              ) : (
                <Pop key="sealed" i={2} className="sealed" exit={{ opacity: 0, y: -8 }}>
                  <Lock size={13} /> Noor left a note at chapter 4.
                  <small>It opens when you get there.</small>
                </Pop>
              )}
              {state.noteOpen && state.reply !== null && (
                <motion.figure
                  key={`reply-${state.reply}`}
                  className="reply"
                  initial={{ opacity: 0, x: 24, rotate: 3 }}
                  animate={{ opacity: 1, x: 0, rotate: 1, transition: { type: 'spring', stiffness: 170, damping: 18 } }}
                  exit={{ opacity: 0, x: 16, transition: { duration: 0.15 } }}
                >
                  <blockquote>“{state.replyText}”</blockquote>
                  <figcaption><Avatar who="you" /> Your reply · waits for Noor’s next visit</figcaption>
                </motion.figure>
              )}
            </AnimatePresence>
          </div>
        </>
      )
    case 4: {
      const left = BALANCE - state.spent
      return (
        <>
          <Pop className="pool" style={{ left: '50%', top: '4%' }}>
            <div className="pool-head">
              <span>Shared pool</span>
              <small>earned together this season</small>
            </div>
            <p className="pool-num"><b>{left}</b> of {BALANCE} seeds left</p>
            <div className="pool-bar" aria-hidden="true">
              {state.decor.map((d) => (
                <i key={d.spot} className={`spent ${d.kind}`} style={{ width: `${decorOf(d.kind).cost}%` }} />
              ))}
              <i className="remaining" />
            </div>
            <p className="pool-legend">
              {state.decor.length
                ? state.decor.map((d) => `${decorOf(d.kind).name} ${decorOf(d.kind).cost}`).join(' · ')
                : 'Nothing spent yet'}
            </p>
          </Pop>
          {state.choosing &&
            SPOTS.map((spot, n) =>
              state.decor.some((d) => d.spot === n) ? null : (
                <motion.button
                  key={`${state.choosing}-${n}`}
                  type="button"
                  className="spot"
                  style={{ ...at(cam, spot.x, spot.y), width: `${Math.max(decorOf(state.choosing).width * cam.s, 6)}%` }}
                  aria-label={`Place ${decorOf(state.choosing).name.toLowerCase()} ${spot.label}`}
                  onClick={() => actions.place(n)}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Sprite kind={state.choosing} />
                </motion.button>
              ),
            )}
        </>
      )
    }
    case 5:
      return (
        <>
          <Pop className="tag demo-tag" style={{ left: '4%', top: '4%' }}>Weeks later · illustrative</Pop>
          <Pop i={1} className={`keepsake ${state.keepsakeOpen ? 'open' : ''}`}>
            <button type="button" className="keepsake-cover" aria-expanded={state.keepsakeOpen} aria-controls="keepsake-history" onClick={actions.toggleKeepsake}>
              <span>
                <span className="keepsake-title">The Lantern House</span>
                <span className="keepsake-sub">Finished together · on your shelf</span>
              </span>
              <ChevronDown size={18} className="chev" />
            </button>
            <AnimatePresence initial={false}>
              {state.keepsakeOpen && (
                <motion.div
                  id="keepsake-history"
                  className="keepsake-body"
                  tabIndex={0}
                  role="region"
                  aria-label="Keepsake history"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1, transition: { duration: 0.5, ease: EASE } }}
                  exit={{ height: 0, opacity: 0, transition: { duration: 0.25 } }}
                >
                  <ol>
                    <li><span>Mar 2</span> Started, the two of you</li>
                    <li><span>Mar 19</span> Noor’s note at chapter 4</li>
                    {state.reply !== null && <li className="mine"><span>Mar 20</span> Your reply: “{state.replyText}”</li>}
                    <li><span>Apr 3</span> Noor underlined a line in chapter 9</li>
                    <li><span>Apr 21</span> Both finished, two days apart</li>
                  </ol>
                </motion.div>
              )}
            </AnimatePresence>
          </Pop>
        </>
      )
    default:
      return null
  }
}

export default function Stage({ index, calm, state, actions }) {
  const cam = cameraFor(index, state.activity)
  const move = calm ? { duration: 0 } : { type: 'spring', stiffness: 46, damping: 17, mass: 1.1 }

  return (
    <section className="stage" aria-label="Illustration of a shared world">
      <div className="frame">
        <div className="motes" aria-hidden="true">
          {MOTES.map(([x, y, d]) => <i key={`${x}-${y}`} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `-${d}s` }} />)}
        </div>
        {index === 1 && !calm && (
          <motion.i
            className="bloom"
            aria-hidden="true"
            initial={{ scale: 0.2, opacity: 0.9 }}
            animate={{ scale: 2.6, opacity: 0 }}
            transition={{ duration: 1.8, ease: [0.1, 0.6, 0.3, 1] }}
          />
        )}
        <motion.div
          className="square art"
          initial={false}
          animate={{
            scale: cam.s,
            x: `${cam.s * (50 - cam.x)}%`,
            y: `${cam.s * (50 - cam.y)}%`,
            rotate: cam.r,
            filter: `brightness(${cam.b}) saturate(${cam.sat}) sepia(${cam.sep})`,
          }}
          transition={move}
        >
          <i className="ground" aria-hidden="true" />
          <img src="/assets/shared-world.png" alt={ALT} draggable="false" />
          <motion.div className="glows" aria-hidden="true" animate={{ opacity: index === 3 ? 1 : 0 }} transition={{ duration: 0.9 }}>
            {GLOWS.map((g) => <i key={`${g.x}-${g.y}`} style={{ left: `${g.x}%`, top: `${g.y}%` }} />)}
          </motion.div>
          {state.decor.map((d) => {
            const spot = SPOTS[d.spot]
            return (
              <div key={d.spot} className={`deco ${d.kind}`} style={{ left: `${spot.x}%`, top: `${spot.y}%`, width: `${decorOf(d.kind).width}%` }}>
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 14 }}
                  style={{ originY: 1 }}
                >
                  <Sprite kind={d.kind} />
                </motion.div>
              </div>
            )
          })}
        </motion.div>

        <div className="square overlay">
          <Plans index={index} cam={cam} activity={state.activity} onPick={actions.pickActivity} />
          <AnimatePresence>
            <motion.div key={index} className="ov-layer" exit={{ opacity: 0, transition: { duration: 0.2 } }}>
              <Overlay index={index} cam={cam} state={state} actions={actions} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
