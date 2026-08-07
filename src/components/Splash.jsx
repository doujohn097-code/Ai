import React, { useEffect, useRef, useState } from 'react'

export default function Splash() {
  const [show, setShow] = useState(true)
  const [fading, setFading] = useState(false)
  const videoRef = useRef(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      finish()
    }, 4500)
    return () => clearTimeout(timer)
  }, [])

  const finish = () => {
    if (!show) return
    setFading(true)
    setTimeout(() => {
      setShow(false)
    }, 600)
  }

  if (!show) return null

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black transition-opacity duration-700 ${fading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      dir="rtl"
    >
      <video
        ref={videoRef}
        src="/intro.mp4"
        autoPlay
        muted
        playsInline
        onEnded={finish}
        className="w-full h-full object-contain"
      />
    </div>
  )
}
