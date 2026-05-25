import React from 'react'

const STARS = {
  near: [
    [8,14,1.7],[22,32,1.4],[38,9,1.6],[55,28,1.5],[72,16,1.4],
    [88,38,1.7],[14,78,1.5],[41,88,1.4],[66,72,1.6],[83,86,1.5],
    [29,62,1.4],[50,50,1.6],[78,56,1.5],
  ],
  mid: [
    [3,28,0.9],[17,8,0.9],[27,22,1],[32,48,0.9],[44,36,1],
    [49,14,0.9],[60,6,1],[67,38,0.9],[76,28,1],[85,18,0.9],
    [93,52,1],[9,52,1],[19,66,0.9],[33,76,1],[45,68,0.9],
    [58,82,1],[70,92,0.9],[80,70,1],[91,76,0.9],[4,92,1],
    [26,95,0.9],[37,18,1],[54,60,0.9],[70,50,1],[89,64,0.9],
  ],
  far: [
    [2,6,0.5],[11,22,0.4],[16,38,0.5],[20,48,0.4],[24,6,0.5],
    [30,36,0.4],[36,52,0.5],[42,22,0.4],[47,42,0.5],[52,6,0.4],
    [56,18,0.5],[62,22,0.4],[68,8,0.5],[73,38,0.4],[79,48,0.5],
    [82,8,0.4],[87,28,0.5],[92,14,0.4],[96,38,0.5],[97,8,0.4],
    [6,64,0.5],[12,86,0.4],[22,72,0.5],[28,88,0.4],[34,60,0.5],
    [40,82,0.4],[46,96,0.5],[52,76,0.4],[58,70,0.5],[62,60,0.4],
    [66,86,0.5],[72,78,0.4],[76,64,0.5],[82,96,0.4],[88,80,0.5],
    [94,92,0.4],[98,70,0.5],[4,38,0.4],[38,68,0.5],[50,90,0.4],
  ],
}

function Starfield() {
  return (
    <svg
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        pointerEvents: 'none',
      }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Faint blue-violet dot fading to transparent */}
        <radialGradient id="sg-far">
          <stop offset="0%"   stopColor="#d4c8ff" stopOpacity={0.9} />
          <stop offset="45%"  stopColor="#c4b5fd" stopOpacity={0.2} />
          <stop offset="100%" stopColor="#c4b5fd" stopOpacity={0} />
        </radialGradient>

        {/* White core, lavender halo */}
        <radialGradient id="sg-mid">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity={1} />
          <stop offset="30%"  stopColor="#e8defc" stopOpacity={0.4} />
          <stop offset="100%" stopColor="#c4b5fd" stopOpacity={0} />
        </radialGradient>

        {/* Slightly brighter than mid, but not dominant */}
        <radialGradient id="sg-near">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity={0.55} />
          <stop offset="22%"  stopColor="#f0eaff" stopOpacity={0.18} />
          <stop offset="55%"  stopColor="#a78bfa" stopOpacity={0.05} />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
        </radialGradient>

        {/* Bloom: blurred copy merged behind the sharp source */}
        <filter id="near-bloom">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.25" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {STARS.far.map(([x, y, r], i) => (
        <circle key={`far-${i}`} cx={x} cy={y} r={r * 0.5} fill="url(#sg-far)" />
      ))}

      {STARS.mid.map(([x, y, r], i) => (
        <circle key={`mid-${i}`} cx={x} cy={y} r={r * 0.75} fill="url(#sg-mid)" />
      ))}

      <g filter="url(#near-bloom)">
        {STARS.near.map(([x, y, r], i) => (
          <circle key={`near-${i}`} cx={x} cy={y} r={r * 0.65} fill="url(#sg-near)" />
        ))}
      </g>
    </svg>
  )
}

export default React.memo(Starfield)
