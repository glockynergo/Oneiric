import {
  BAR,
  PPQ,
  clamp,
  songLength,
  ticksPerSecond,
  type Clip,
  type Mix,
  type Mode,
  type Pattern,
  type Project,
  type Sound,
} from './model'
type Ctx = AudioContext | OfflineAudioContext
type Hit = {
  tick: number
  sample: string
  velocity: number
  rate: number
  offset: number
  duration: number
  fade: number
  bus: string[]
  mono?: string
  audio?: boolean
}
type Bus = { input: GainNode; pan: StereoPannerNode; meter: AnalyserNode }
export class AudioBank {
  raw = new Map<string, ArrayBuffer>()
  buffers = new Map<string, AudioBuffer>()
  private pending = new Map<string, Promise<void>>()
  async load(ctx: BaseAudioContext, s: Sound) {
    if (this.buffers.has(s.id)) return
    if (this.pending.has(s.id)) return this.pending.get(s.id)
    const job = (async () => {
      let bytes = this.raw.get(s.id)
      if (!bytes) {
        if (!s.url) throw Error('Sample mancante: ' + s.name)
        const r = await fetch(s.url)
        if (!r.ok) throw Error('Sample non disponibile: ' + s.name)
        bytes = await r.arrayBuffer()
      }
      const b = await ctx.decodeAudioData(bytes.slice(0))
      this.raw.set(s.id, bytes)
      this.buffers.set(s.id, b)
    })()
    this.pending.set(s.id, job)
    try {
      await job
    } finally {
      this.pending.delete(s.id)
    }
  }
}
export const bank = new AudioBank()
export function events(p: Project, mode: Mode, pattern: string) {
  const list: Hit[] = [],
    tps = ticksPerSecond(p)
  const add = (pt: Pattern, at: number, t?: string) => {
    for (const n of pt.notes) {
      const c = p.channels.find((x) => x.id === n.ch),
        b = c && bank.buffers.get(c.sample)
      if (!c || !b || n.at >= pt.bars * BAR) continue
      const rate = 2 ** (((n.step ? 0 : n.pitch - c.root) + c.tune) / 12)
      const d = (b.duration * (c.end - c.start)) / rate
      list.push({
        tick: at + n.at,
        sample: c.sample,
        velocity: n.v,
        rate,
        offset: c.start * b.duration,
        duration: c.mode === 'gate' ? Math.min(d, n.length / tps) : d,
        fade: c.fade,
        bus: [t ? t + '/' + c.id : c.id],
        mono: c.mono ? (t ?? '') + c.id : undefined,
      })
    }
  }
  if (mode === 'pattern') {
    const pt = p.patterns.find((x) => x.id === pattern)
    if (pt) add(pt, 0)
  } else
    for (const tr of p.tracks)
      for (const c of tr.clips) {
        if (c.type === 'pattern') {
          const pt = p.patterns.find((x) => x.id === c.ref)
          if (pt) add(pt, c.at, tr.id)
        } else if (bank.buffers.has(c.ref))
          list.push({
            tick: c.at,
            sample: c.ref,
            velocity: 1,
            rate: 1,
            offset: c.offset,
            duration: c.duration,
            fade: c.fade,
            bus: [tr.id],
            audio: true,
          })
      }
  list.sort((a, b) => a.tick - b.tick)
  const last = new Map<string, Hit>()
  for (const h of list)
    if (h.mono) {
      const old = last.get(h.mono)
      if (old) old.duration = Math.min(old.duration, (h.tick - old.tick) / tps)
      last.set(h.mono, h)
    }
  return list
}
class Graph {
  master: GainNode
  meter: AnalyserNode
  buses = new Map<string, Bus>()
  constructor(public ctx: Ctx) {
    this.master = ctx.createGain()
    this.meter = ctx.createAnalyser()
    this.meter.fftSize = 1024
    this.master.connect(this.meter).connect(ctx.destination)
  }
  bus(id: string, to: AudioNode = this.master) {
    let b = this.buses.get(id)
    if (!b) {
      const input = this.ctx.createGain(),
        pan = this.ctx.createStereoPanner(),
        meter = this.ctx.createAnalyser()
      meter.fftSize = 512
      input.connect(pan).connect(meter).connect(to)
      b = { input, pan, meter }
      this.buses.set(id, b)
    }
    return b
  }
  sync(p: Project) {
    this.master.gain.value = p.master
    const set = (b: Bus, m: Mix, solo: boolean) => {
      b.input.gain.value = m.mute || (solo && !m.solo) ? 0 : m.volume
      b.pan.pan.value = m.pan
    }
    const cs = p.channels.some((c) => c.solo),
      ts = p.tracks.some((t) => t.solo)
    for (const c of p.channels) set(this.bus(c.id), c, cs)
    for (const t of p.tracks) {
      const tr = this.bus(t.id)
      set(tr, t, ts)
      for (const c of p.channels) set(this.bus(t.id + '/' + c.id, tr.input), c, cs)
    }
  }
  voice(h: Hit, when: number, skip = 0, limit = Infinity) {
    const b = bank.buffers.get(h.sample),
      len = Math.min(h.duration - skip, limit)
    if (!b || len <= 0) return
    const src = this.ctx.createBufferSource(),
      env = this.ctx.createGain()
    src.buffer = b
    src.playbackRate.value = h.rate
    const fade = Math.min(h.fade, h.duration / 2),
      gain = (t: number) =>
        h.velocity * (fade ? clamp(Math.min(t, h.duration - t) / fade, 0, 1) : 1)
    env.gain.setValueAtTime(gain(skip), when)
    if (skip < fade)
      env.gain.linearRampToValueAtTime(h.velocity, when + Math.min(len, fade - skip))
    const release = Math.max(0, h.duration - fade - skip)
    if (release < len) {
      env.gain.setValueAtTime(gain(skip + release), when + release)
      env.gain.linearRampToValueAtTime(gain(skip + len), when + len)
    }
    src.connect(env).connect(this.bus(h.bus[0]).input)
    src.start(when, h.offset + skip * h.rate)
    src.stop(when + len)
    src.onended = () => {
      src.disconnect()
      env.disconnect()
    }
    return src
  }
}
export const engine = new (class {
  ctx?: AudioContext
  graph?: Graph
  playing = false
  loop = true
  metro = false
  region = false
  previewVolume = 0.55
  private previewGain?: GainNode
  private previewSrc?: AudioBufferSourceNode
  private previewRequest = 0
  private monoVoices = new Map<string, { src: AudioBufferSourceNode; end: number }>()
  private p?: Project
  private mode: Mode = 'pattern'
  private pattern = ''
  private hits: Hit[] = []
  private anchor = 0
  private origin = 0
  private cursor = 0
  private end = BAR
  private begin = 0
  private speed = 1
  private stopped = 0
  private timer?: number
  private pendingStart = 0
  private nodes = new Map<AudioScheduledSourceNode, number>()
  async ready() {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.graph = new Graph(this.ctx)
      this.previewGain = this.ctx.createGain()
      this.previewGain.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    return this.ctx
  }
  async prepare(p: Project, sounds: Sound[]) {
    const ctx = await this.ready()
    const ids = new Set([
      ...p.channels.map((c) => c.sample),
      ...p.tracks.flatMap((t) => t.clips.filter((c) => c.type === 'audio').map((c) => c.ref)),
    ])
    await Promise.all(
      [...ids].map((id) => {
        const s = sounds.find((x) => x.id === id)
        return s && (s.url || bank.raw.has(id)) ? bank.load(ctx, s) : undefined
      }),
    )
  }
  async preview(s: Sound) {
    const token = ++this.previewRequest
    const ctx = await this.ready()
    await bank.load(ctx, s)
    if (token !== this.previewRequest) return
    this.previewSrc?.stop()
    const n = ctx.createBufferSource()
    n.buffer = bank.buffers.get(s.id)!
    this.previewGain!.gain.value = this.previewVolume
    n.connect(this.previewGain!)
    n.start()
    n.onended = () => n.disconnect()
    this.previewSrc = n
  }
  setPreview(v: number) {
    this.previewVolume = v
    if (this.previewGain) this.previewGain.gain.value = v
  }
  private limits(p: Project) {
    this.speed = ticksPerSecond(p)
    this.begin = this.mode === 'song' && this.region ? p.range[0] : 0
    this.end =
      this.mode === 'song'
        ? this.region
          ? p.range[1]
          : songLength(p)
        : (p.patterns.find((x) => x.id === this.pattern)?.bars ?? 1) * BAR
  }
  private absolute() {
    return this.origin + Math.max(0, this.ctx!.currentTime - this.anchor) * this.speed
  }
  private wrap(t: number) {
    const size = this.end - this.begin
    return this.loop && t >= this.end
      ? this.begin + ((t - this.end) % size)
      : Math.min(t, this.end)
  }
  position() {
    return this.playing ? this.wrap(this.absolute()) : this.stopped
  }
  private clear(all: boolean) {
    const now = this.ctx?.currentTime ?? 0
    for (const [n, time] of this.nodes)
      if (all || time >= now) {
        try {
          n.stop()
        } catch {}
        this.nodes.delete(n)
      }
  }
  configure(p: Project, m: Mode, id: string) {
    const pos = this.position(),
      oldMode = this.mode,
      oldPattern = this.pattern
    this.p = p
    this.mode = m
    this.pattern = id
    this.limits(p)
    this.hits = events(p, m, id)
    this.graph?.sync(p)
    const switched = m !== oldMode || id !== oldPattern
    if (this.playing) {
      this.clear(switched)
      this.origin = switched ? this.begin : this.wrap(Math.max(this.begin, pos))
      this.anchor = this.ctx!.currentTime
      this.cursor = this.origin + (switched ? 0 : 0.00001)
      this.schedule()
    } else this.stopped = switched ? this.begin : clamp(this.stopped, this.begin, this.end)
  }
  async play(p: Project, m: Mode, id: string, sounds: Sound[]) {
    const token = ++this.pendingStart
    await this.prepare(p, sounds)
    if (token !== this.pendingStart) return
    this.configure(p, m, id)
    if (this.playing) return
    this.clear(true)
    this.monoVoices.clear()
    this.origin =
      this.stopped >= this.end ? this.begin : clamp(this.stopped, this.begin, this.end)
    this.cursor = this.origin
    this.anchor =
      Math.ceil((this.ctx!.currentTime + 0.025) * this.ctx!.sampleRate) / this.ctx!.sampleRate
    this.playing = true
    this.resumeHeld()
    this.schedule()
    this.timer = window.setInterval(() => this.schedule(), 25)
  }
  private resumeHeld() {
    for (const h of this.hits) {
      const skip = (this.origin - h.tick) / this.speed
      if (skip > 0 && skip < h.duration) this.fire(h, this.anchor, skip)
    }
  }
  private track(n: AudioScheduledSourceNode | undefined, at: number) {
    if (n) {
      this.nodes.set(n, at)
      n.addEventListener('ended', () => this.nodes.delete(n), { once: true })
    }
  }
  private fire(h: Hit, at: number, skip = 0) {
    const limit = this.loop && h.audio ? (this.end - h.tick) / this.speed - skip : Infinity
    const src = this.graph!.voice(h, at, skip, limit)
    this.track(src, at)
    if (src && h.mono) {
      const old = this.monoVoices.get(h.mono)
      if (old && old.end > at)
        try {
          old.src.stop(at)
        } catch {}
      this.monoVoices.set(h.mono, { src, end: at + Math.min(h.duration - skip, limit) })
    }
  }
  private schedule() {
    if (!this.playing || !this.ctx || !this.p) return
    const abs = this.absolute(),
      now = this.ctx.currentTime,
      limit = this.loop ? abs + 0.13 * this.speed : Math.min(this.end, abs + 0.13 * this.speed)
    if (!this.loop && abs >= this.end) {
      this.stopped = this.begin
      this.playing = false
      clearInterval(this.timer)
      return
    }
    let a = Math.max(this.cursor, abs - 0.025 * this.speed)
    while (a < limit - 1e-8) {
      const local = this.wrap(a),
        span = Math.min(limit - a, this.end - local)
      if (span <= 1e-8) break
      const clock = (tick: number) =>
        Math.max(now, this.anchor + (a + tick - local - this.origin) / this.speed)
      if (this.loop && a > this.origin && Math.abs(local - this.begin) < 1e-7) {
        for (const h of this.hits) {
          const skip = (local - h.tick) / this.speed
          if (h.audio && skip > 0 && skip < h.duration) this.fire(h, clock(local), skip)
        }
      }
      for (const h of this.hits)
        if (h.tick >= local - 1e-8 && h.tick < local + span - 1e-8) this.fire(h, clock(h.tick))
      if (this.metro)
        for (let k = Math.ceil(local / PPQ) * PPQ; k < local + span; k += PPQ) {
          const osc = this.ctx.createOscillator(),
            g = this.ctx.createGain(),
            w = clock(k)
          osc.frequency.value = k % BAR ? 950 : 1450
          g.gain.setValueAtTime(0.12, w)
          g.gain.exponentialRampToValueAtTime(0.0001, w + 0.035)
          osc.connect(g).connect(this.ctx.destination)
          osc.start(w)
          osc.stop(w + 0.04)
          this.track(osc, w)
          osc.onended = () => {
            osc.disconnect()
            g.disconnect()
          }
        }
      a += span
    }
    this.cursor = limit
  }
  pause() {
    this.pendingStart++
    this.stopped = this.position()
    this.playing = false
    clearInterval(this.timer)
    this.clear(true)
    this.monoVoices.clear()
  }
  stop() {
    this.pause()
    this.stopped = 0
    this.previewRequest++
    this.previewSrc?.stop()
  }
  seek(t: number) {
    this.stopped = clamp(t, this.begin, this.end)
    if (this.playing) {
      this.clear(true)
      this.origin = this.stopped
      this.cursor = this.origin
      this.anchor = this.ctx!.currentTime + 0.01
      this.resumeHeld()
      this.schedule()
    }
  }
  level(id?: string) {
    if (!this.graph) return 0
    const meters = id
      ? [...this.graph.buses]
          .filter(([k]) => k === id || k.endsWith('/' + id))
          .map(([, b]) => b.meter)
      : [this.graph.meter]
    let v = 0
    for (const meter of meters) {
      const values = new Float32Array(meter.fftSize)
      meter.getFloatTimeDomainData(values)
      for (const x of values) v = Math.max(v, Math.abs(x))
    }
    return v
  }
})()
export async function renderMix(p: Project, sounds: Sound[], range?: [number, number]) {
  await engine.prepare(p, sounds)
  const hits = events(p, 'song', ''),
    tps = ticksPerSecond(p),
    [start, end] = range ?? [0, songLength(p)]
  const audible = hits
    .filter((h) => h.tick < end && h.tick + h.duration * tps > start)
    .map((h) =>
      range && h.audio ? { ...h, duration: Math.min(h.duration, (end - h.tick) / tps) } : h,
    )
  const length = Math.max(
    (end - start) / tps,
    ...audible.map((h) => (h.tick - start) / tps + h.duration),
  )
  const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(length * 44100)), 44100),
    graph = new Graph(ctx)
  graph.sync(p)
  for (const h of audible)
    graph.voice(h, Math.max(0, (h.tick - start) / tps), Math.max(0, (start - h.tick) / tps))
  return ctx.startRendering()
}
export function clipFromSound(s: Sound, at: number): Clip {
  return {
    id: crypto.randomUUID(),
    type: 'audio',
    ref: s.id,
    at,
    offset: 0,
    duration: bank.buffers.get(s.id)!.duration,
    fade: 0.005,
  }
}
