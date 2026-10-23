export const CHAPTERS = [
  {
    id: 'apart',
    nav: 'Apart',
    kicker: 'beside · for friends who live apart',
    title: ['Somewhere in the chat', 'is a book you meant', 'to read together.'],
    body: [
      'Distance doesn’t end a friendship, but it quietly takes the everyday parts: reading side by side, the stretch before work, the dinner you were going to cook. Plans drift up the thread and out of sight.',
    ],
    lede: 'Beside gives the things you want to do together a home.',
    palette: { bg: '#e8e5ec', ink: '#25212d', accent: '#6a5a96', stage: '#d9d4e1' },
  },
  {
    id: 'world',
    nav: 'One world',
    kicker: 'One shared space per connection',
    title: ['A small world', 'for the people', 'you already love.'],
    body: [
      'Each friendship, or a close group who already know each other, gets its own space. The book, the morning stretch, the recipe and the trip you keep mentioning all live there, side by side.',
      'Every space is private and separate, built around the people and activities you choose.',
    ],
    palette: { bg: '#eef0e1', ink: '#1e2a1d', accent: '#4c7537', stage: '#dde5c6' },
  },
  {
    id: 'pace',
    nav: 'Own pace',
    kicker: 'Together, at your own pace',
    title: ['Same book.', 'Different', 'Tuesdays.'],
    body: [
      'Start from a template or make your own. You share the activity, not the schedule: you’re on chapter 3, Noor is on chapter 4, and each of you keeps a goal that fits your week.',
      'Beside is async first. Nobody has to be online at the same time.',
    ],
    palette: { bg: '#f5ecdb', ink: '#2b2117', accent: '#ad532b', stage: '#ecdcbd' },
  },
  {
    id: 'notes',
    nav: 'Notes',
    kicker: 'A friend leaves something for you',
    title: ['Notes that wait', 'for the right page.'],
    body: [
      'When Noor logs progress, a small marker appears over her avatar. A note she leaves on chapter 4 stays sealed until you get there: no spoilers, just a conversation picking up exactly where you are.',
    ],
    palette: { bg: '#29233a', ink: '#f6eedf', accent: '#f1b55e', stage: '#372e48' },
    dark: true,
  },
  {
    id: 'grow',
    nav: 'Grow',
    kicker: 'Participation makes a place',
    title: ['Show up together', 'and the world', 'fills in.'],
    body: [
      'Progress you contribute to shared activities earns credit for a shared pool, and effort from both of you counts for far more than either alone. Spend it together on what your world needs next.',
      'A tree, then another tree, and over time a forest. A place shaped by the things you keep coming back to together.',
    ],
    palette: { bg: '#e5efe2', ink: '#16301f', accent: '#2c7a4c', stage: '#cfe3c8' },
  },
  {
    id: 'keep',
    nav: 'Keepsakes',
    kicker: 'Experiences become keepsakes',
    title: ['Finished things', 'stay on the shelf.'],
    body: [
      'Weeks later in this story, you both turn the last page. The book becomes an object in your world, and its shared history stays inside: when you started, the notes you traded, the week you finished.',
    ],
    palette: { bg: '#f5e5e2', ink: '#2e1a1e', accent: '#b0405a', stage: '#eed2ce' },
  },
]

export const TEMPLATES = ['Read a book', 'Move', 'Cook', 'Plan a trip', 'Your own']

// Camera per chapter: scale, focus point in art %, rotation and grade.
export const CAMS = [
  { s: 0.64, x: 70, y: 50, r: -3, b: 1.02, sat: 0.22, sep: 0.05 },
  { s: 0.92, x: 50, y: 50, r: 0, b: 1, sat: 1, sep: 0 },
  { s: 1.5, x: 50, y: 47, r: 0, b: 1.02, sat: 1.02, sep: 0.06 },
  { s: 2.5, x: 29, y: 46, r: 0, b: 0.6, sat: 0.85, sep: 0.15 },
  { s: 1.08, x: 56, y: 52, r: 0, b: 1.03, sat: 1.1, sep: 0 },
  { s: 0.82, x: 62, y: 50, r: 0, b: 1.04, sat: 1.06, sep: 0.1 },
]

// Chapter two zooms toward the selected activity.
export const ACTIVITIES = [
  { id: 'reading', label: 'Reading', plan: '“read that book together?”', x: 27, y: 42, cam: { s: 1.35, x: 36, y: 50 }, from: { left: 23, top: 22, r: -5 } },
  { id: 'moving', label: 'Moving', plan: '“sunday stretch call”', x: 74, y: 41, cam: { s: 1.35, x: 66, y: 48 }, from: { left: 19, top: 53, r: 3 } },
  { id: 'cooking', label: 'Cooking', plan: '“cook Nani’s dal”', x: 46, y: 19, cam: { s: 1.35, x: 46, y: 34 }, from: { left: 25, top: 82, r: -2 } },
]

export const BALANCE = 100
export const DECOR = [
  { id: 'tree', name: 'Tree', cost: 50, width: 8 },
  { id: 'lantern', name: 'Lantern', cost: 30, width: 3.6 },
  { id: 'flowers', name: 'Flowers', cost: 20, width: 7 },
]
export const SPOTS = [
  { x: 13, y: 62, label: 'by the patio wall' },
  { x: 56, y: 58, label: 'on the garden path' },
  { x: 29, y: 79, label: 'at the pond’s edge' },
]

export const REPLIES = [
  'Completely. I don’t trust him anymore.',
  'Not yet. Ask me again at chapter 6.',
  'I underlined the same line.',
]
