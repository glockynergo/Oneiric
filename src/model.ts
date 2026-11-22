export const PPQ = 96,
  BAR = PPQ * 4,
  STEP = PPQ / 4
export const uid = () => crypto.randomUUID()
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
export type Sound = {
  id: string
  name: string
  category: string
  kit: string
  url?: string
  root?: number
  bpm?: number
  key?: string
  duration?: number
  local?: boolean
}
export type Mix = {
  id: string
  name: string
  volume: number
  pan: number
  mute: boolean
  solo: boolean
}
export type Channel = Mix & {
  sample: string
  root: number
  tune: number
  start: number
  end: number
  fade: number
  mode: 'one' | 'gate'
  mono: boolean
}
export type Note = {
  id: string
  ch: string
  at: number
  length: number
  pitch: number
  v: number
  step: boolean
}
export type Pattern = { id: string; name: string; bars: number; notes: Note[] }
export type Clip = {
  id: string
  type: 'audio' | 'pattern'
  ref: string
  at: number
  offset: number
  duration: number
  fade: number
}
export type Track = Mix & { clips: Clip[] }
export type Project = {
  version: 1
  name: string
  bpm: number
  master: number
  channels: Channel[]
  patterns: Pattern[]
  tracks: Track[]
  locals: Sound[]
  range: [number, number]
}
export type Mode = 'pattern' | 'song'
export const mix = (name: string): Mix => ({
  id: uid(),
  name,
  volume: 0.78,
  pan: 0,
  mute: false,
  solo: false,
})
export const channel = (s: Sound): Channel => ({
  ...mix(s.name),
  sample: s.id,
  root: s.root ?? 60,
  tune: 0,
  start: 0,
  end: 1,
  fade: 0.004,
  mode: 'one',
  mono: false,
})
export const pat = (name: string): Pattern => ({ id: uid(), name, bars: 1, notes: [] })
export const track = (name: string): Track => ({ ...mix(name), volume: 1, clips: [] })
export const note = (c: Channel, at: number, step = true): Note => ({
  id: uid(),
  ch: c.id,
  at,
  length: STEP,
  pitch: c.root,
  v: 0.88,
  step,
})
export const patternClip = (ref: string, at: number): Clip => ({
  id: uid(),
  ref,
  at,
  type: 'pattern',
  offset: 0,
  duration: 0,
  fade: 0,
})
export function createProject(sounds: Sound[], demo: boolean): Project {
  const p = pat('Pattern 01'),
    tr = track('Batteria')
  const channels = demo
    ? ['kick-lunar', 'clap-halo', 'hat-dust', 'perc-orbit'].map((id, i) => {
        const c = channel(sounds.find((s) => s.id === id)!)
        c.volume = [0.87, 0.72, 0.48, 0.56][i]
        return c
      })
    : []
  if (demo) {
    const steps = [
      [0, 6, 8, 14],
      [4, 12],
      [0, 2, 4, 6, 8, 10, 12, 14, 15],
      [3, 7, 11, 14],
    ]
    channels.forEach((c, i) =>
      steps[i].forEach((n, j) =>
        p.notes.push({ ...note(c, n * STEP), v: i === 2 ? (j % 2 ? 0.55 : 0.82) : 0.9 }),
      ),
    )
    tr.clips = [0, 1, 2, 3].map((b) => patternClip(p.id, b * BAR))
  }
  return {
    version: 1,
    name: demo ? 'Midnight Orbit' : 'Progetto senza titolo',
    bpm: 128,
    master: 0.82,
    channels,
    patterns: [p],
    tracks: [tr],
    locals: [],
    range: [0, 4 * BAR],
  }
}
export const ticksPerSecond = (p: Project) => (p.bpm * PPQ) / 60
export const clipTicks = (c: Clip, p: Project) =>
  c.type === 'pattern'
    ? (p.patterns.find((x) => x.id === c.ref)?.bars ?? 1) * BAR
    : c.duration * ticksPerSecond(p)
export const songLength = (p: Project) =>
  Math.max(BAR, ...p.tracks.flatMap((t) => t.clips.map((c) => c.at + clipTicks(c, p))))
export const db = (v: number) =>
  v ? (20 * Math.log10(v)).toFixed(1).replace('.', ',') + ' dB' : '−∞ dB'
export const num = (n: number) => String(n).padStart(2, '0')
export const pitchName = (n: number) =>
  ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'][n % 12] +
  (Math.floor(n / 12) - 1)
