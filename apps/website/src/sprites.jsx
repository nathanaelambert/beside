import React from 'react'

const SPRITES = {
  tree: {
    rows: [
      '....dGGd....',
      '..dGGgGGGd..',
      '.dGgGGGGgGd.',
      'dGGGGgGGGGGd',
      'GgGGGGGGgGGd',
      'dGGgGGGGGGgd',
      '.dGGGGgGGGd.',
      '..ddGGGGdd..',
      '....dTTd....',
      '.....TT.....',
      '....sTTs....',
    ],
    fill: { G: '#4f8a3c', g: '#7cb556', d: '#33602b', T: '#7a4a2a', s: 'rgba(30,40,20,.35)' },
  },
  lantern: {
    rows: [
      '..ddd..',
      '.dLLLd.',
      '.dYyYd.',
      '.dyYyd.',
      '.dYyYd.',
      '.dLLLd.',
      '...d...',
      '...d...',
      '...d...',
      '...d...',
      '..ddd..',
      '.sssss.',
    ],
    fill: { d: '#3b2a22', L: '#5a3f2e', Y: '#ffd27a', y: '#ffb347', s: 'rgba(30,40,20,.3)' },
  },
  flowers: {
    rows: [
      '..P....W....',
      '.PyP..WyW.P.',
      '..P.g..W.PyP',
      '.g..g.g.g.P.',
      'gGgGgGgGgGgg',
      '.GgGgGGgGgG.',
      '..ssssssss..',
    ],
    fill: { P: '#e98aa8', W: '#f6f1e4', y: '#f2c94c', g: '#6fae4f', G: '#4f8a3c', s: 'rgba(30,40,20,.3)' },
  },
}

export function Sprite({ kind }) {
  const { rows, fill } = SPRITES[kind]
  return (
    <svg viewBox={`0 0 ${rows[0].length} ${rows.length}`} shapeRendering="crispEdges" aria-hidden="true" className={`sprite ${kind}`}>
      {rows.flatMap((row, y) =>
        [...row].map((c, x) => (c === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" fill={fill[c]} />)),
      )}
    </svg>
  )
}
