import React, { useState } from 'react'

export function Avatar({ src, name, size = 40, online = false }) {
  const [err, setErr] = useState(false)
  const initials = name ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '?'
  const showImg = src && !err

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <div
        className="rounded-full overflow-hidden flex items-center justify-center text-white font-semibold bg-[#111] ring-1 ring-white/10"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.36,
        }}
      >
        {showImg ? (
          <img src={src} alt={name} className="w-full h-full object-cover" onError={() => setErr(true)} />
        ) : (
          initials
        )}
      </div>
      {online && (
        <span
          className="absolute bottom-0 right-0 rounded-full bg-green-500 border-2 border-black"
          style={{
            width: Math.max(10, size * 0.28),
            height: Math.max(10, size * 0.28),
          }}
        />
      )}
    </div>
  )
}
