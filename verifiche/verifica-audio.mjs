import * as native from 'node-web-audio-api'
import { readFile, writeFile, rename } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
const scratch = await mkdtemp(join(tmpdir(), 'oneiric-test-'))
const moduleFile = join(scratch, 'audio-test.mjs')
await build({
  stdin: {
    contents:
      "export * from './src/model';export * from './src/audio';export * from './src/files'",
    resolveDir: root,
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: moduleFile,
})

const {
  createProject,
  engine,
  renderMix,
  serialize,
  openProject,
  importWave,
  waveFile,
  events,
  clipFromSound,
  note,
  channel,
  track,
  BAR,
  STEP,
  uid,
} = await import(pathToFileURL(moduleFile).href)
globalThis.window = globalThis
globalThis.OfflineAudioContext = native.OfflineAudioContext
globalThis.AudioContext = class extends native.AudioContext {
  constructor() {
    super({ sampleRate: 44100, sinkId: { type: 'none' } })
  }
}
globalThis.FileReader = class {
  async readAsDataURL(blob) {
    this.result =
      'data:audio/wav;base64,' + Buffer.from(await blob.arrayBuffer()).toString('base64')
    this.onload()
  }
}
const kit = JSON.parse(await readFile(join(root, 'src/catalog.json'), 'utf8'))
globalThis.fetch = async (url) => new Response(await readFile(join(root, 'public', url)))
const p = createProject(kit, true),
  pt = p.patterns[0],
  pause = (ms) => new Promise((r) => setTimeout(r, ms))
await engine.play(p, 'pattern', pt.id, kit)
await pause(210)
assert(engine.playing && engine.position() > 0)
assert.equal(events(p, 'pattern', pt.id).length, 19)
let before = engine.position()
p.channels[0].sample = 'kick-nova'
await engine.prepare(p, kit)
engine.configure(p, 'pattern', pt.id)
assert(engine.position() >= before - 0.01)
assert.equal(events(p, 'pattern', pt.id).filter((h) => h.sample === 'kick-nova').length, 4)
const original = await readFile(join(root, 'public/sounds/kick-lunar.wav'))
let sample = await importWave(new File([original], 'Kick personale.wav'))
p.locals.push(sample)
const notes = JSON.stringify(pt.notes),
  control = { ...p.channels[0] }
p.channels[0].sample = sample.id
await engine.preview(sample)
engine.configure(p, 'pattern', pt.id)
assert.equal(JSON.stringify(pt.notes), notes)
assert.deepEqual({ ...p.channels[0], sample: control.sample }, control)
assert(engine.playing)
await assert.rejects(importWave(new File(['incorrect'], 'errore.wav')), /valido/)
p.bpm = 144
engine.configure(p, 'pattern', pt.id)
before = engine.position()
await pause(120)
assert(Math.abs(engine.position() - before - 27.65) < 9)
engine.pause()
before = engine.position()
await pause(60)
assert.equal(engine.position(), before)
await engine.play(p, 'pattern', pt.id, [...kit, ...p.locals])
await pause(70)
assert(engine.position() > before)
engine.stop()
assert.equal(engine.position(), 0)
assert(!engine.playing)
console.log(
  'OK demo, import valido e rifiuto file errato, anteprima, cambio kick in loop, BPM, pausa/ripresa, Stop',
)
p.bpm = 150
const f = kit.find((x) => x.bpm),
  path = join(scratch, 'melodia-prova.wav')
await writeFile(path, await readFile(join(root, 'public', f.url)))
const melody = await importWave(new File([await readFile(path)], 'Melodia prova.wav'))
p.locals.push(melody)
const mt = track('Melodia')
p.tracks.push(mt)
const ac = clipFromSound(melody, BAR)
ac.offset = 0.25
ac.duration = 0.86
ac.fade = 0.04
mt.clips.push(ac)
mt.pan = 0.36
mt.volume = 0.64
const bassSample = kit.find((x) => x.category === '808'),
  bass = channel(bassSample)
bass.mode = 'gate'
bass.mono = true
bass.volume = 0.45
p.channels.push(bass)
pt.notes.push(
  { ...note(bass, 0, false), length: 96 },
  { ...note(bass, 192, false), pitch: bass.root + 3, length: 144 },
)
const fill = structuredClone(pt)
fill.name = 'Fill finale'
fill.id = uid()
fill.notes.push(note(p.channels[1], STEP * 15))
p.patterns.push(fill)
p.tracks[0].clips[3].ref = fill.id
p.range = [BAR * 2, BAR * 4]
await engine.prepare(p, [...kit, ...p.locals])
let ev = events(p, 'song', '')
assert(ev.some((h) => h.audio && h.tick === BAR && h.offset === 0.25 && h.duration === 0.86))
const audio = await renderMix(p, [...kit, ...p.locals]),
  w = waveFile(audio)
await writeFile(join(scratch, 'test-mix.wav'), Buffer.from(await w.blob.arrayBuffer()))
const json = await serialize(p, [...kit, ...p.locals])
await rename(path, join(scratch, 'melodia-spostata.wav'))
const restored = await openProject(json, kit)
assert.deepEqual(restored.missing, [])
assert.equal(JSON.stringify(restored.project), JSON.stringify(p))
const reopened = await renderMix(restored.project, [...kit, ...p.locals])
let max = 0,
  energy = 0
for (let ch = 0; ch < 2; ch++) {
  const a = audio.getChannelData(ch),
    b = reopened.getChannelData(ch)
  for (let i = 0; i < a.length; i++) {
    max = Math.max(max, Math.abs(a[i] - b[i]))
    energy += a[i] ** 2
  }
}
assert.equal(max, 0)
assert(energy > 1)
const range = await renderMix(p, [...kit, ...p.locals], p.range)
assert(range.length < audio.length)
assert(range.length >= ((2 * BAR) / ((p.bpm * 96) / 60)) * 44100)
let portable = JSON.parse(json)
delete portable.samples[melody.id]
assert((await openProject(JSON.stringify(portable), kit)).missing.includes(melody.id))
await importWave(
  new File([await readFile(join(scratch, 'melodia-spostata.wav'))], 'Nuova posizione.wav'),
  melody.id,
)
const chk = await renderMix(p, [...kit, ...p.locals])
assert.deepEqual(chk.getChannelData(0), audio.getChannelData(0))
console.log(
  'OK clip WAV rifilata, 808 intonato, fill indipendente, intervallo, portabilità dopo spostamento, ricollegamento; max differenza prima/dopo riapertura',
  max,
  'campioni per canale',
  audio.length,
)
const ctx = await engine.ready(),
  proc = ctx.createScriptProcessor(1024, 2, 2),
  record = [[], []]
proc.onaudioprocess = (e) => {
  for (let k = 0; k < 2; k++) record[k].push(new Float32Array(e.inputBuffer.getChannelData(k)))
}
engine.graph.master.connect(proc)
const silent = ctx.createGain()
silent.gain.value = 0
proc.connect(silent).connect(ctx.destination)
engine.stop()
engine.loop = false
engine.region = false
engine.metro = false
await engine.play(p, 'song', pt.id, [...kit, ...p.locals])
await pause(audio.duration * 1000 + 300)
engine.stop()
proc.disconnect()
silent.disconnect()
const concat = (arr) => {
  const result = new Float32Array(arr.length * 1024)
  arr.forEach((v, i) => result.set(v, i * 1024))
  return result
}
const live = record.map(concat),
  a = audio.getChannelData(0)
let best = -1,
  bestShift = 0
for (let shift = -1600; shift < 6000; shift++) {
  let dot = 0,
    b2 = 0,
    a2 = 0
  for (let i = 2000; i < 6200; i += 8) {
    let v = live[0][i + shift] ?? 0
    dot += v * a[i]
    b2 += v * v
    a2 += a[i] ** 2
  }
  const corr = dot / Math.sqrt(a2 * b2 || 1)
  if (corr > best) {
    best = corr
    bestShift = shift
  }
}
let sum = 0,
  ref = 0
for (let ch = 0; ch < 2; ch++) {
  const a = audio.getChannelData(ch)
  for (let i = Math.max(0, -bestShift); i < a.length; i++) {
    const d = (live[ch][i + bestShift] ?? 0) - a[i]
    sum += d * d
    ref += a[i] * a[i]
  }
}
const rel = Math.sqrt(sum / ref)
console.log(
  'Confronto tempo reale → export: allineamento',
  bestShift,
  'campioni, correlazione iniziale',
  best.toFixed(5),
  'errore RMS relativo',
  rel.toFixed(6),
)
assert(best > 0.99 && rel < 0.02, 'Differenza eccessiva nel confronto live/offline')
const decodedWav = await ctx.decodeAudioData(await w.blob.arrayBuffer())
assert.equal(decodedWav.length, audio.length)
let quantization = 0
for (let ch = 0; ch < 2; ch++) {
  const a = audio.getChannelData(ch),
    b = decodedWav.getChannelData(ch)
  for (let i = 0; i < a.length; i++) quantization = Math.max(quantization, Math.abs(a[i] - b[i]))
}
assert(quantization <= 2 / 32768)
const muted = structuredClone(p)
muted.tracks.forEach((t) => (t.mute = true))
const silentExport = await renderMix(muted, [...kit, ...p.locals])
assert(silentExport.getChannelData(0).every((x) => x === 0))
console.log(
  'OK WAV riletto, coda inclusa e mute delle tracce. Errore massimo di quantizzazione:',
  quantization,
)
await ctx.close()
await rm(scratch, { recursive: true, force: true })
