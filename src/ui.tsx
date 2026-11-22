import {
  AudioLines,
  Check,
  Disc3,
  Drum,
  Menu as MenuIcon,
  MoreHorizontal,
  Music2,
  Sparkles,
  Triangle,
  Waves,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { bank, engine } from './audio'
import { type Channel, type Mode, type Pattern, type Project, type Sound } from './model'
export type Studio = {
  p: Project
  edit: (fn: (p: Project) => void) => void
  sounds: Sound[]
  pt: Pattern
  c?: Channel
  setChannel: (id: string) => void
  setPattern: (id: string) => void
  mode: Mode
  setMode: (m: Mode) => void
  pos: number
  playing: boolean
  notify: (m: string) => void
  ask: (title: string, value: string, cb: (s: string) => void) => void
  confirm: (title: string, cb: () => void) => void
  loadFiles: (files: File[], after?: (s: Sound[]) => void) => Promise<void>
  bar: number
  setBar: (b: number) => void
}
export function IconButton({
  label,
  children,
  onClick,
  active = false,
  disabled = false,
  className = '',
}: {
  label: string
  children: ReactNode
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={'icon ' + (active ? 'active ' : '') + className}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
export type Item = { name: string; action: () => void; disabled?: boolean }
export function Menu({
  items,
  label = 'Altre opzioni',
  children,
}: {
  items: Item[]
  label?: string
  children?: ReactNode
}) {
  const [open, set] = useState(false),
    ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
        if (!ref.current?.contains(e.target as Node)) set(false)
      },
      esc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') set(false)
      }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  return (
    <div className="menu-wrap" ref={ref}>
      <button
        aria-expanded={open}
        title={label}
        aria-label={label}
        className={children ? 'menu-trigger' : 'icon'}
        onClick={() => set(!open)}
      >
        {children ?? <MoreHorizontal size={18} />}
      </button>
      {open && (
        <div className="menu-pop" role="menu">
          {items.map((i, k) => (
            <button
              key={k}
              role="menuitem"
              disabled={i.disabled}
              onClick={() => {
                set(false)
                i.action()
              }}
            >
              {i.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
export function SoundIcon({ cat }: { cat?: string }) {
  const Icon =
    cat === 'Kick'
      ? Disc3
      : cat === 'Clap' || cat === 'Snare'
        ? Drum
        : cat === 'Hi-hat'
          ? Triangle
          : cat === 'Perc'
            ? AudioLines
            : cat === 'FX'
              ? Sparkles
              : cat === 'Melodia'
                ? Music2
                : Waves
  return (
    <span className={'sound-icon cat-' + (cat ?? 'audio').toLowerCase()}>
      <Icon size={18} strokeWidth={1.6} />
    </span>
  )
}
export function Wave({
  sound,
  color = '#94a4bf',
  width = 260,
  height = 44,
  offset = 0,
  fraction = 1,
}: {
  sound?: Sound
  color?: string
  width?: number
  height?: number
  offset?: number
  fraction?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let active = true
    const draw = (b?: AudioBuffer) => {
      const c = ref.current
      if (!active || !c) return
      const g = c.getContext('2d')
      if (!g) return
      g.clearRect(0, 0, width, height)
      g.fillStyle = color
      g.fillRect(0, height / 2, width, 0.8)
      if (!b) return
      const values = b.getChannelData(0),
        from = Math.floor(offset * b.length),
        len = Math.max(1, Math.floor(fraction * b.length))
      for (let i = 0; i < width; i += 3) {
        let peak = 0
        const a = Math.floor((i / width) * len) + from,
          z = Math.min(b.length, from + Math.ceil(((i + 3) / width) * len))
        for (let j = a; j < z; j += Math.max(1, Math.floor((z - a) / 160)))
          peak = Math.max(peak, Math.abs(values[j]))
        const h = Math.max(1, Math.pow(peak, 0.6) * (height - 2))
        g.fillRect(i, (height - h) / 2, 2, h)
      }
    }
    if (sound) {
      const b = bank.buffers.get(sound.id)
      if (b) draw(b)
      else if (sound.url) {
        const offline = new OfflineAudioContext(1, 1, 44100)
        bank
          .load(offline, sound)
          .then(() => draw(bank.buffers.get(sound.id)))
          .catch(() => draw())
      } else draw()
    } else draw()
    return () => {
      active = false
    }
  }, [
    sound?.id,
    sound?.url,
    bank.buffers.get(sound?.id ?? ''),
    color,
    width,
    height,
    offset,
    fraction,
  ])
  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      className="wave"
      aria-label={'Forma d’onda ' + (sound?.name ?? '')}
    />
  )
}
export function Modal({
  title,
  close,
  children,
}: {
  title: string
  close: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    d?.showModal()
    return () => d?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close()
      }}
    >
      <div className="dialog-inner">
        <div className="dialog-title">
          <h2>{title}</h2>
          <IconButton label="Chiudi" onClick={close}>
            <X />
          </IconButton>
        </div>
        {children}
      </div>
    </dialog>
  )
}
export function Meter({ id }: { id?: string }) {
  const [peak, set] = useState(0),
    [clip, setClip] = useState(false)
  useEffect(() => {
    const n = setInterval(() => {
      const v = engine.level(id)
      set(v)
      if (v >= 1) setClip(true)
    }, 70)
    return () => clearInterval(n)
  }, [id])
  return (
    <div className="meter-wrap">
      <div className="meter">
        <i
          style={{
            width: Math.min(100, Math.max(0, 100 + 20 * Math.log10(peak || 0.00001) * 1.6)) + '%',
          }}
        />
      </div>
      <button
        title="Azzera indicatore di clipping"
        onClick={() => setClip(false)}
        className={'clip-ind ' + (clip ? 'over' : '')}
      >
        CLIP
      </button>
    </div>
  )
}
export function Range({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  change,
  display,
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  change: (n: number) => void
  display?: string
}) {
  return (
    <label className="range-label">
      <span>
        {label}
        <b>{display ?? value}</b>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => change(+e.target.value)}
      />
    </label>
  )
}
export { Check, MenuIcon }
