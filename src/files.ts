import { bank, engine } from './audio'
import { type Project, type Sound, uid } from './model'
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}
export async function importWave(file: File, relink?: string): Promise<Sound> {
  const bytes = await file.arrayBuffer(),
    sig = new TextDecoder('ascii')
  if (sig.decode(bytes.slice(0, 4)) !== 'RIFF' || sig.decode(bytes.slice(8, 12)) !== 'WAVE')
    throw Error(file.name + ' non è un file WAV valido.')
  const ctx = await engine.ready()
  let b: AudioBuffer
  try {
    b = await ctx.decodeAudioData(bytes.slice(0))
  } catch {
    throw Error('Il browser non riesce a decodificare ' + file.name + '. Prova un WAV PCM.')
  }
  const id = relink ?? uid()
  bank.raw.set(id, bytes)
  bank.buffers.set(id, b)
  return {
    id,
    name: file.name.replace(/\.wav$/i, ''),
    category: 'Audio',
    kit: 'File locali',
    local: true,
    duration: b.duration,
  }
}
export function usedIds(p: Project) {
  return [
    ...new Set([
      ...p.channels.map((x) => x.sample),
      ...p.tracks.flatMap((t) => t.clips.filter((c) => c.type === 'audio').map((c) => c.ref)),
      ...p.locals.map((s) => s.id),
    ]),
  ]
}
async function base64(bytes: ArrayBuffer) {
  return new Promise<string>((ok, fail) => {
    const r = new FileReader()
    r.onerror = () => fail(Error('Lettura sample fallita'))
    r.onload = () => ok(String(r.result).split(',')[1])
    r.readAsDataURL(new Blob([bytes]))
  })
}
export async function serialize(p: Project, sounds: Sound[]) {
  const samples: Record<string, string> = {}
  for (const id of usedIds(p)) {
    const s = sounds.find((x) => x.id === id)
    if (!bank.raw.has(id) && s?.url) await bank.load(await engine.ready(), s)
    const data = bank.raw.get(id)
    if (data) samples[id] = await base64(data)
  }
  return JSON.stringify({ format: 'oneiric', version: 1, project: p, samples })
}
export async function openProject(text: string, kit: Sound[]) {
  let doc
  try {
    doc = JSON.parse(text)
  } catch {
    throw Error('Il file non contiene un progetto Oneiric leggibile.')
  }
  const p: Project = doc?.project
  if (
    doc?.format !== 'oneiric' ||
    doc.version !== 1 ||
    !p ||
    !Array.isArray(p.patterns) ||
    !p.patterns.length ||
    !Array.isArray(p.tracks) ||
    !Array.isArray(p.channels) ||
    !Array.isArray(p.locals) ||
    !p.range ||
    p.bpm < 30 ||
    p.bpm > 300 ||
    !Number.isFinite(p.bpm) ||
    typeof p.name !== 'string'
  )
    throw Error('Formato o versione del progetto non supportati.')
  const finite = (v: unknown, min: number, max = Infinity) =>
    typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
  const validMix = (m: Project['channels'][0] | Project['tracks'][0]) =>
    typeof m.id === 'string' &&
    typeof m.name === 'string' &&
    finite(m.volume, 0, 2) &&
    finite(m.pan, -1, 1)
  if (
    !finite(p.master, 0, 2) ||
    !finite(p.range[0], 0) ||
    !finite(p.range[1], p.range[0] + 1) ||
    p.channels.some(
      (c) =>
        !validMix(c) ||
        !finite(c.start, 0, 1) ||
        !finite(c.end, c.start + 0.000001, 1) ||
        !finite(c.root, 0, 127) ||
        !finite(c.tune, -48, 48) ||
        !finite(c.fade, 0, 10) ||
        typeof c.sample !== 'string',
    ) ||
    p.patterns.some(
      (pt) =>
        !Number.isInteger(pt.bars) ||
        !finite(pt.bars, 1, 64) ||
        typeof pt.name !== 'string' ||
        !Array.isArray(pt.notes) ||
        pt.notes.some(
          (n) =>
            !finite(n.at, 0) ||
            !finite(n.length, 1) ||
            !finite(n.pitch, 0, 127) ||
            !finite(n.v, 0, 1) ||
            !p.channels.some((c) => c.id === n.ch),
        ),
    ) ||
    p.tracks.some(
      (t) =>
        !validMix(t) ||
        !Array.isArray(t.clips) ||
        t.clips.some(
          (c) =>
            !finite(c.at, 0) ||
            !finite(c.offset, 0) ||
            !finite(c.duration, 0) ||
            !finite(c.fade, 0, 10) ||
            !['audio', 'pattern'].includes(c.type) ||
            (c.type === 'pattern' && !p.patterns.some((pt) => pt.id === c.ref)),
        ),
    )
  )
    throw Error('Il progetto contiene dati musicali non validi.')
  p.locals = p.locals
    .filter((s) => typeof s.id === 'string' && typeof s.name === 'string')
    .map((s) => ({ ...s, local: true, url: undefined }))
  const decoded = new Map<string, { bytes: ArrayBuffer; b: AudioBuffer }>(),
    missing: string[] = []
  const ctx = await engine.ready()
  for (const id of usedIds(p)) {
    const data = doc.samples?.[id]
    if (typeof data === 'string')
      try {
        const bytes = Uint8Array.from(atob(data), (x) => x.charCodeAt(0)).buffer
        decoded.set(id, { bytes, b: await ctx.decodeAudioData(bytes.slice(0)) })
        continue
      } catch {
        /* Relink unreadable entries. */
      }
    if (!kit.some((s) => s.id === id)) {
      missing.push(id)
      if (!p.locals.some((s) => s.id === id))
        p.locals.push({ id, name: id, category: 'Audio', kit: 'File locali', local: true })
    }
  }
  engine.stop()
  bank.raw.clear()
  bank.buffers.clear()
  for (const [id, { bytes, b }] of decoded) {
    bank.raw.set(id, bytes)
    bank.buffers.set(id, b)
  }
  return { project: p, missing }
}
let dbPromise: Promise<IDBDatabase> | undefined
const db = () =>
  (dbPromise ??= new Promise((ok, fail) => {
    const r = indexedDB.open('oneiric-studio', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('session')
    r.onsuccess = () => ok(r.result)
    r.onerror = () => fail(r.error)
  }))
export async function autosave(text: string | null) {
  const d = await db()
  await new Promise<void>((ok, fail) => {
    const tx = d.transaction('session', 'readwrite')
    const store = tx.objectStore('session')
    if (text === null) store.delete('recovery')
    else store.put(text, 'recovery')
    tx.oncomplete = () => ok()
    tx.onerror = () => fail(tx.error)
    tx.onabort = () => fail(tx.error)
  })
}
export async function recovery() {
  const d = await db()
  return new Promise<string | undefined>((ok, fail) => {
    const r = d.transaction('session').objectStore('session').get('recovery')
    r.onsuccess = () => ok(r.result)
    r.onerror = () => fail(r.error)
  })
}
export function waveFile(b: AudioBuffer) {
  const data = new ArrayBuffer(44 + b.length * 4),
    v = new DataView(data)
  const str = (off: number, s: string) =>
    [...s].forEach((c, i) => v.setUint8(off + i, c.charCodeAt(0)))
  str(0, 'RIFF')
  v.setUint32(4, data.byteLength - 8, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 2, true)
  v.setUint32(24, b.sampleRate, true)
  v.setUint32(28, b.sampleRate * 4, true)
  v.setUint16(32, 4, true)
  v.setUint16(34, 16, true)
  str(36, 'data')
  v.setUint32(40, b.length * 4, true)
  const left = b.getChannelData(0),
    right = b.getChannelData(1)
  let clipped = false
  for (let i = 0; i < b.length; i++) {
    for (let ch = 0; ch < 2; ch++) {
      const a = ch ? right[i] : left[i]
      if (Math.abs(a) > 1) clipped = true
      v.setInt16(
        44 + 4 * i + 2 * ch,
        Math.round(Math.max(-1, Math.min(1, a)) * (a < 0 ? 32768 : 32767)),
        true,
      )
    }
  }
  return { blob: new Blob([data], { type: 'audio/wav' }), clipped }
}
