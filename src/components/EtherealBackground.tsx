import React from 'react'

function EtherealBackground() {
  return (
    <>
      {/* Aurora blobs — slow drifting gradients */}
      <div aria-hidden style={{
        position: 'fixed', inset: 0, zIndex: -2, pointerEvents: 'none', overflow: 'hidden',
      }}>
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
        <div className="aurora-blob aurora-blob-4" />
      </div>

      {/* Noise texture overlay */}
      <svg
        aria-hidden
        style={{
          position: 'fixed', inset: 0, width: '100%', height: '100%',
          zIndex: -1, pointerEvents: 'none', opacity: 0.045,
        }}
      >
        <filter id="eth-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#eth-noise)" />
      </svg>
    </>
  )
}

export default React.memo(EtherealBackground)
