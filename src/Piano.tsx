import {
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Copy,
  CopyPlus,
  Magnet,
  Piano as PianoIcon,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as PE } from 'react'
import { Patterns } from './Drums'
import { BAR, clamp, note, num, pitchName, STEP, uid, type Note } from './model'
import { IconButton, type Studio } from './ui'
export default function Piano({ s }: { s: Studio }) {
  const editor = useRef<HTMLElement>(null)
  const [oct, setOct] = useState(() => clamp(Math.floor((s.c?.root ?? 60) / 12) * 12, 0, 104)),
    [snap, setSnap] = useState(STEP),
    [selected, setSelected] = useState<string[]>([]),
    [clip, setClip] = useState<Note[]>([]),
    [cursor, setCursor] = useState(0),
    [draft, setDraft] = useState<Note[]>([])
  const grid = useRef<HTMLDivElement>(null),
    drag = useRef<{
      x: number
      y: number
      base: Note[]
      resize: boolean
      id: string
      pending: Note[]
    } | null>(null)
  const base = s.bar * BAR,
    c = s.c
  const visible = s.pt.notes.filter((n) => n.ch === c?.id && n.at >= base && n.at < base + BAR)
  const selectedNotes = s.pt.notes.filter((n) => n.ch === c?.id && selected.includes(n.id))
  const editNotes = (fn: (notes: Note[]) => Note[]) =>
    s.edit((p) => {
      const pt = p.patterns.find((x) => x.id === s.pt.id)!
      pt.notes = fn(pt.notes)
    })
  const point = (e: PE | React.MouseEvent) => {
    const b = grid.current!.getBoundingClientRect()
    return {
      t: clamp(((e.clientX - b.left) / b.width) * BAR, 0, BAR - 1),
      pitch: oct + 23 - clamp(Math.floor(((e.clientY - b.top) / b.height) * 24), 0, 23),
    }
  }
  const quant = (v: number, alt: boolean, down = false) => {
    const q = alt ? 1 : snap
    return (down ? Math.floor(v / q) : Math.round(v / q)) * q
  }
  const insert = (e: PE) => {
    grid.current?.focus()
    if (!c || e.button !== 0) return
    const { t, pitch } = point(e),
      at = base + quant(t, e.altKey, true)
    setCursor(at)
    const n = {
      ...note(c, at, false),
      pitch,
      length: Math.min(snap === 1 ? STEP : snap, base + BAR - at),
    }
    editNotes((ns) => [...ns, n])
    setSelected([n.id])
  }
  const down = (e: PE, n: Note, resize: boolean) => {
    e.stopPropagation()
    if (e.button !== 0) return
    let ids = selected
    if (e.shiftKey || e.ctrlKey) {
      ids = ids.includes(n.id) ? ids.filter((id) => id !== n.id) : [...ids, n.id]
    } else if (!ids.includes(n.id)) ids = [n.id]
    setSelected(ids)
    setCursor(n.at)
    if (!ids.includes(n.id)) return
    const items = s.pt.notes.filter((x) => x.ch === c?.id && ids.includes(x.id))
    drag.current = { x: e.clientX, y: e.clientY, base: items, resize, id: n.id, pending: [] }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move = (e: PE) => {
    const d = drag.current,
      b = grid.current?.getBoundingClientRect()
    if (!d || !b) return
    const dx = quant(((e.clientX - d.x) / b.width) * BAR, e.altKey),
      dy = -Math.round(((e.clientY - d.y) / b.height) * 24)
    if (!dx && !dy && !d.pending.length) return
    const delta = clamp(
      dx,
      -Math.min(...d.base.map((n) => n.at)),
      s.pt.bars * BAR - 1 - Math.max(...d.base.map((n) => n.at)),
    )
    d.pending = d.base.map((n) =>
      d.resize
        ? { ...n, length: clamp(n.length + dx, 1, s.pt.bars * BAR - n.at) }
        : { ...n, at: n.at + delta, pitch: clamp(n.pitch + dy, 0, 127), step: false },
    )
    setDraft(d.pending)
  }
  const finish = () => {
    const d = drag.current
    if (d?.pending.length)
      editNotes((ns) => ns.map((n) => d.pending.find((x) => x.id === n.id) ?? n))
    drag.current = null
    setDraft([])
  }
  const paste = (items: Note[], at: number) => {
    if (!items.length || !c) return
    const start = Math.min(...items.map((n) => n.at)),
      ns = items
        .map((n) => ({ ...n, id: uid(), at: n.at - start + at, ch: c.id }))
        .filter((n) => n.at < s.pt.bars * BAR)
    if (!ns.length) return s.notify('Allunga il pattern per inserire le note.')
    editNotes((notes) => [...notes, ...ns])
    setSelected(ns.map((n) => n.id))
  }
  const duplicate = () =>
    paste(selectedNotes, Math.max(...selectedNotes.map((n) => n.at + n.length)))
  const remove = () => {
    editNotes((ns) => ns.filter((n) => !selected.includes(n.id)))
    setSelected([])
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!editor.current?.contains(document.activeElement)) return
      if (
        document.querySelector('dialog[open]') ||
        (e.target as HTMLElement).closest('input,select,textarea')
      )
        return
      const ctrl = e.ctrlKey || e.metaKey
      if (e.key === 'Delete' && selectedNotes.length) {
        e.preventDefault()
        remove()
      }
      if (ctrl) {
        if (e.key === 'c' && selectedNotes.length) {
          e.preventDefault()
          setClip(structuredClone(selectedNotes))
        }
        if (e.key === 'v') {
          e.preventDefault()
          paste(clip, cursor)
        }
        if (e.key === 'd' && selectedNotes.length) {
          e.preventDefault()
          duplicate()
        }
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })
  const notes = visible.map((n) => draft.find((x) => x.id === n.id) ?? n)
  return (
    <section className="panel piano-editor" ref={editor} tabIndex={-1}>
      <div className="panel-head">
        <div className="panel-titles">
          <PianoIcon size={18} />
          <h2>Piano Roll</h2>
        </div>
        <Patterns s={s} />
      </div>
      <div className="editor-toolbar">
        <select
          aria-label="Canale del Piano Roll"
          value={c?.id ?? ''}
          onChange={(e) => {
            s.setChannel(e.target.value)
            setSelected([])
            const ch = s.p.channels.find((c) => c.id === e.target.value)!
            setOct(clamp(Math.floor(ch.root / 12) * 12, 0, 104))
          }}
        >
          {s.p.channels.map((c) => (
            <option value={c.id} key={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Magnet size={14} />
        <select
          aria-label="Griglia del Piano Roll"
          value={snap}
          onChange={(e) => setSnap(+e.target.value)}
        >
          {[
            [96, '1/4'],
            [48, '1/8'],
            [24, '1/16'],
            [12, '1/32'],
            [1, 'Libera'],
          ].map(([n, v]) => (
            <option key={n} value={n}>
              {v}
            </option>
          ))}
        </select>
        <div className="tool-spacer" />
        <IconButton
          label="Copia note"
          disabled={!selectedNotes.length}
          onClick={() => setClip(structuredClone(selectedNotes))}
        >
          <Copy size={15} />
        </IconButton>
        <IconButton
          label="Incolla note"
          disabled={!clip.length}
          onClick={() => paste(clip, cursor)}
        >
          <Clipboard size={15} />
        </IconButton>
        <IconButton label="Duplica note" disabled={!selectedNotes.length} onClick={duplicate}>
          <CopyPlus size={15} />
        </IconButton>
        <IconButton label="Elimina note" disabled={!selectedNotes.length} onClick={remove}>
          <Trash2 size={15} />
        </IconButton>
      </div>
      <div className="piano-ruler">
        <button
          className="oct-btn"
          title="Ottava inferiore"
          disabled={oct === 0}
          onClick={() => setOct(Math.max(0, oct - 12))}
        >
          −8va
        </button>
        <div>
          {[0, 1, 2, 3].map((i) => (
            <button
              key={i}
              title="Posiziona il cursore di incolla"
              onClick={() => setCursor(base + i * 96)}
            >
              {s.bar + 1}.{i + 1}
            </button>
          ))}
        </div>
      </div>
      <div className="piano-area">
        <div className="keys">
          {Array.from({ length: 24 }, (_, i) => {
            const n = oct + 23 - i
            return (
              <span key={n} className={pitchName(n).includes('♯') ? 'black' : ''}>
                {pitchName(n)}
              </span>
            )
          })}
        </div>
        <div
          className="note-grid"
          ref={grid}
          tabIndex={0}
          aria-label="Griglia delle note"
          onPointerDown={insert}
          onPointerMove={move}
          onPointerUp={finish}
          onPointerCancel={() => {
            drag.current = null
            setDraft([])
          }}
          style={{
            backgroundSize:
              100 / (BAR / (snap === 1 ? STEP : snap)) +
              '% 100%, 25% 100%, 100% ' +
              100 / 24 +
              '%',
          }}
        >
          {notes
            .filter((n) => n.pitch >= oct && n.pitch < oct + 24)
            .map((n) => (
              <button
                key={n.id}
                className={'piano-note ' + (selected.includes(n.id) ? 'sel' : '')}
                aria-label={pitchName(n.pitch) + ' · tick ' + n.at}
                style={{
                  left: ((n.at - base) / BAR) * 100 + '%',
                  width: (Math.min(n.length, base + BAR - n.at) / BAR) * 100 + '%',
                  top: ((oct + 23 - n.pitch) / 24) * 100 + '%',
                  height: 100 / 24 + '%',
                }}
                onPointerDown={(e) => down(e, n, false)}
                onClick={(e) => {
                  if (e.detail === 0) setSelected([n.id])
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  editNotes((ns) => ns.filter((x) => x.id !== n.id))
                }}
              >
                <span>{pitchName(n.pitch)}</span>
                <i title="Allunga nota" onPointerDown={(e) => down(e, n, true)} />
              </button>
            ))}
          <i
            className="playhead"
            style={{ left: (((s.playing ? s.pos : cursor) % BAR) / BAR) * 100 + '%' }}
          />
        </div>
      </div>
      <div className="editor-toolbar">
        <button
          className="oct-btn"
          title="Ottava superiore"
          disabled={oct >= 104}
          onClick={() => setOct(Math.min(104, oct + 12))}
        >
          +8va
        </button>
        <IconButton
          label="Battuta precedente"
          disabled={!s.bar}
          onClick={() => {
            s.setBar(s.bar - 1)
            setCursor(base - BAR)
          }}
        >
          <ChevronLeft size={14} />
        </IconButton>
        <small>
          Battuta {num(s.bar + 1)} / {num(s.pt.bars)}
        </small>
        <IconButton
          label="Battuta successiva"
          disabled={s.bar + 1 >= s.pt.bars}
          onClick={() => {
            s.setBar(s.bar + 1)
            setCursor(base + BAR)
          }}
        >
          <ChevronRight size={14} />
        </IconButton>
        {selectedNotes.length > 0 && (
          <label className="velocity-inline">
            Velocity
            <input
              aria-label="Velocity note"
              type="range"
              min=".01"
              max="1"
              step=".01"
              value={selectedNotes[0].v}
              onChange={(e) => {
                const v = +e.target.value
                editNotes((ns) => ns.map((n) => (selected.includes(n.id) ? { ...n, v } : n)))
              }}
            />
          </label>
        )}
      </div>
      <div className="editor-hint">
        {c
          ? 'Clic per disegnare · Trascina il bordo per allungare · Maiusc per selezionare · Alt per sganciare'
          : 'Aggiungi un canale nello Step Sequencer per disegnare le note.'}
      </div>
    </section>
  )
}
