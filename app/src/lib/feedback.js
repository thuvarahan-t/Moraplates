import { REDUCED_MOTION } from './motion.js'

let audio

export function tapHaptic(duration = 12) {
  if (!REDUCED_MOTION && typeof navigator !== 'undefined') navigator.vibrate?.(duration)
}

/** Play a short, quiet pop from the like gesture without downloading an audio asset. */
export function playLikeSound() {
  if (typeof window === 'undefined') return
  const Audio = window.AudioContext || window.webkitAudioContext
  if (!Audio) return

  try {
    audio ??= new Audio()
    const play = () => {
      const now = audio.currentTime
      const tone = audio.createOscillator()
      const volume = audio.createGain()
      tone.frequency.setValueAtTime(620, now)
      tone.frequency.exponentialRampToValueAtTime(300, now + .09)
      volume.gain.setValueAtTime(.001, now)
      volume.gain.exponentialRampToValueAtTime(.07, now + .01)
      volume.gain.exponentialRampToValueAtTime(.001, now + .09)
      tone.connect(volume)
      volume.connect(audio.destination)
      tone.start(now)
      tone.stop(now + .09)
      tone.onended = () => { tone.disconnect(); volume.disconnect() }
    }
    if (audio.state === 'running') play()
    else audio.resume().then(play).catch(() => {})
  } catch {
    // Browser audio may be blocked even after the user interacts.
  }
}
