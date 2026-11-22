import {
  Clipboard,
  Copy,
  CopyPlus,
  Layers,
  LayoutList,
  Magnet,
  Music2,
  Plus,
  Repeat2,
  Scissors,
  Settings2,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as PE } from 'react'
import { bank, clipFromSound, engine } from './audio'
import {
  BAR,
  STEP,
  clamp,
  clipTicks,
  num,
  patternClip,
  songLength,
  ticksPerSecond,
  track,
  uid,
  type Clip,
  type Sound,
} from './model'
import { IconButton, Menu, Modal, Range, Wave, type Studio } from './ui'
type Located = { clip: Clip; row: number }
export default function Timeline({
  s,
  region,
  setRegion,
}: {
  s: Studio
  region: boolean
  setRegion: (v: boolean) => void
}) {
  const editor = useRef<HTMLElement>(null)
  const [sel, setSel] = useState<string[]>([]),
    [trId, setTrack] = useState(s.p.tracks[0]?.id),
    [cursor, setCursor] = useState(0),
    [px, zoom] = useState(148),
    [snap, setSnap] = useState(BAR),
    [clipboard, setClipboard] = useState<Located[]>([]),
    [props, showProps] = useState(false),
    [delta, setDelta] = useState(0)
  const input = useRef<HTMLInputElement>(null),
    drag = useRef<{
      x: number
      y: number
      kind: string
      ids: string[]
      clip: Clip
      row: number
      q: number
    } | null>(null)
  const tracks = s.p.tracks,
    activeTrack = tracks.find((t) => t.id === trId) ?? tracks[0],
    all = tracks.flatMap((t, row) => t.clips.map((clip) => ({ clip, row }))),
    selection = all.filter((x) => sel.includes(x.clip.id)),
    one = selection.length === 1 ? selection[0] : undefined
  const tps = ticksPerSecond(s.p),
    bars = Math.max(
      8,
      Math.ceil(songLength(s.p) / BAR) + 2,
      Math.ceil(s.p.range[1] / BAR) + 1,
      Math.floor(cursor / BAR) + 2,
    ),
    width = px * bars
  const snapTo = (v: number, alt = false) =>
    Math.max(0, Math.round(v / (alt ? 1 : snap)) * (alt ? 1 : snap))
  const addTrack = () =>
    s.ask('Nuova traccia', 'Traccia ' + num(tracks.length + 1), (name) => {
      const t = track(name)
      s.edit((p) => p.tracks.push(t))
      setTrack(t.id)
    })
  const seek = (t: number) => {
    setCursor(t)
    s.setMode('song')
    engine.configure(s.p, 'song', s.pt.id)
    engine.seek(t)
  }
  const insert = (clip: Clip, tr = activeTrack?.id) => {
    s.edit((p) => {
      let t = p.tracks.find((t) => t.id === tr)
      if (!t) {
        t = track('Traccia 01')
        p.tracks.push(t)
        setTrack(t.id)
      }
      t.clips.push(clip)
    })
    setSel([clip.id])
  }
  const addSounds = async (sounds: Sound[], at: number, id = activeTrack?.id) => {
    const clips: Clip[] = []
    for (const sound of sounds) {
      await bank.load(await engine.ready(), sound)
      const c = clipFromSound(sound, at)
      clips.push(c)
      at += Math.round(clipTicks(c, s.p))
    }
    if (!clips.length) return
    s.edit((p) => {
      let t = p.tracks.find((t) => t.id === id)
      if (!t) {
        t = track('Audio')
        p.tracks.push(t)
        setTrack(t.id)
      }
      t.clips.push(...clips)
    })
    setSel(clips.map((c) => c.id))
  }
  const copy = () => setClipboard(structuredClone(selection))
  const paste = (xs: Located[], at: number, target: number) => {
    if (!xs.length) return
    const min = Math.min(...xs.map((x) => x.clip.at)),
      row = Math.min(...xs.map((x) => x.row))
    const ids: string[] = []
    s.edit((p) => {
      for (const x of xs) {
        const tIndex = target + x.row - row
        while (p.tracks.length <= tIndex)
          p.tracks.push(track('Traccia ' + num(p.tracks.length + 1)))
        const c = { ...x.clip, id: uid(), at: at + x.clip.at - min }
        p.tracks[tIndex].clips.push(c)
        ids.push(c.id)
      }
    })
    setSel(ids)
  }
  const duplicate = () =>
    paste(
      selection,
      Math.max(...selection.map((x) => x.clip.at + clipTicks(x.clip, s.p))),
      Math.min(...selection.map((x) => x.row)),
    )
  const remove = () => {
    s.edit((p) => p.tracks.forEach((t) => (t.clips = t.clips.filter((c) => !sel.includes(c.id)))))
    setSel([])
  }
  const split = () => {
    if (!one || one.clip.type !== 'audio') return
    const c = one.clip,
      dt = (cursor - c.at) / tps
    if (dt <= 0.001 || dt >= c.duration - 0.001)
      return s.notify('Posiziona il cursore dentro la clip audio usando il righello.')
    s.edit((p) => {
      const t = p.tracks[one.row],
        old = t.clips.find((x) => x.id === c.id)!
      t.clips.push({
        ...old,
        id: uid(),
        at: cursor,
        offset: old.offset + dt,
        duration: old.duration - dt,
      })
      old.duration = dt
    })
  }
  const unique = () => {
    if (!one || one.clip.type !== 'pattern') return
    const src = s.p.patterns.find((x) => x.id === one.clip.ref)!
    s.ask('Rendi unica la clip', src.name + ' · fill', (name) => {
      const pt = structuredClone(src)
      pt.id = uid()
      pt.name = name
      s.edit((p) => {
        p.patterns.push(pt)
        p.tracks[one.row].clips.find((c) => c.id === one.clip.id)!.ref = pt.id
      })
      s.setPattern(pt.id)
      s.notify(name + ' selezionato nello Step Sequencer')
    })
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!editor.current?.contains(document.activeElement)) return
      if (
        document.querySelector('dialog[open]') ||
        (e.target as HTMLElement).closest('input,select,textarea')
      )
        return
      if (e.key === 'Delete' && selection.length) {
        e.preventDefault()
        remove()
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'c' && selection.length) {
          e.preventDefault()
          copy()
        }
        if (e.key === 'v' && clipboard.length) {
          e.preventDefault()
          paste(clipboard, cursor, Math.max(0, tracks.indexOf(activeTrack)))
        }
        if (e.key === 'd' && selection.length) {
          e.preventDefault()
          duplicate()
        }
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })
  const down = (e: PE, c: Clip, row: number, kind: string) => {
    if (e.button !== 0) return
    e.stopPropagation()
    let ids = sel
    if (e.shiftKey || e.ctrlKey)
      ids = ids.includes(c.id) ? ids.filter((id) => id !== c.id) : [...ids, c.id]
    else if (!ids.includes(c.id)) ids = [c.id]
    setSel(ids)
    setTrack(tracks[row].id)
    if (!ids.includes(c.id)) return
    drag.current = { x: e.clientX, y: e.clientY, clip: c, row, kind, ids, q: 0 }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move = (e: PE) => {
    const d = drag.current
    if (!d) return
    const q = e.altKey ? 1 : snap,
      dx = Math.round((((e.clientX - d.x) / px) * BAR) / q) * q
    d.q = dx
    setDelta(dx)
  }
  const up = (e: PE) => {
    const d = drag.current
    if (!d) return
    drag.current = null
    setDelta(0)
    const target = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest<HTMLElement>('[data-track]'),
      targetRow = target ? tracks.findIndex((t) => t.id === target.dataset.track) : d.row
    if (!d.q && targetRow === d.row) return
    s.edit((p) => {
      const c = p.tracks[d.row].clips.find((x) => x.id === d.clip.id)
      if (!c) return
      if (d.kind === 'move') {
        const xs = all.filter((x) => d.ids.includes(x.clip.id)),
          da = Math.max(-Math.min(...xs.map((x) => x.clip.at)), d.q),
          dr = clamp(
            targetRow - d.row,
            -Math.min(...xs.map((x) => x.row)),
            tracks.length - 1 - Math.max(...xs.map((x) => x.row)),
          )
        p.tracks.forEach((t) => (t.clips = t.clips.filter((x) => !d.ids.includes(x.id))))
        for (const x of xs) p.tracks[x.row + dr].clips.push({ ...x.clip, at: x.clip.at + da })
      } else if (d.kind === 'left') {
        const sec = clamp(d.q / tps, -Math.min(c.offset, c.at / tps), c.duration - 0.005)
        c.at += sec * tps
        c.offset += sec
        c.duration -= sec
      } else
        c.duration = clamp(
          c.duration + d.q / tps,
          0.005,
          (bank.buffers.get(c.ref)?.duration ?? c.offset + c.duration) - c.offset,
        )
    })
  }
  const editClip = (values: Partial<Clip>) => {
    if (one)
      s.edit((p) =>
        Object.assign(
          p.tracks[one.row].clips.find((c) => c.id === one.clip.id)!,
          values,
        ),
      )
  }
  const addRange = (side: 0 | 1, value: number) => {
    if (!Number.isFinite(value)) return
    const tick = Math.max(0, (Math.floor(value) - (side === 0 ? 1 : 0)) * BAR)
    s.edit((p) => {
      p.range[side] =
        side === 0 ? Math.min(tick, p.range[1] - BAR) : Math.max(tick, p.range[0] + BAR)
    })
  }
  return (
    <section className="panel timeline" ref={editor} tabIndex={-1}>
      <div className="panel-head">
        <div className="panel-titles">
          <LayoutList size={19} />
          <h2>Timeline</h2>
        </div>
        <button className="ghost dashed" onClick={addTrack}>
          <Plus size={14} />
          Traccia
        </button>
      </div>
      <div className="editor-toolbar">
        <button
          title="Inserisci il pattern selezionato al cursore"
          onClick={() => insert(patternClip(s.pt.id, cursor))}
        >
          <Plus size={14} />
          Pattern
        </button>
        <button onClick={() => input.current?.click()}>
          <Upload size={14} />
          WAV
        </button>
        <Magnet size={14} />
        <select
          aria-label="Griglia timeline"
          value={snap}
          onChange={(e) => setSnap(+e.target.value)}
        >
          {[
            [BAR, 'Battuta'],
            [96, '1/4'],
            [STEP, '1/16'],
            [1, 'Libera'],
          ].map(([k, v]) => (
            <option value={k} key={k}>
              {v}
            </option>
          ))}
        </select>
        <div className="tool-spacer" />
        <IconButton
          label="Riduci zoom"
          disabled={px <= 70}
          onClick={() => zoom(Math.max(70, px - 32))}
        >
          <ZoomOut size={15} />
        </IconButton>
        <IconButton
          label="Aumenta zoom"
          disabled={px >= 340}
          onClick={() => zoom(Math.min(340, px + 32))}
        >
          <ZoomIn size={15} />
        </IconButton>
      </div>
      <div className="timeline-scroll">
        <div className="arrange-grid" style={{ width: width + 144 }}>
          <div className="timeline-top">
            <span>TRACCE</span>
            <div
              className="time-ruler"
              style={{ width }}
              onClick={(e) =>
                seek(
                  snapTo(
                    ((e.clientX - e.currentTarget.getBoundingClientRect().left) / px) * BAR,
                    e.altKey,
                  ),
                )
              }
            >
              {Array.from({ length: bars }, (_, i) => (
                <b key={i} style={{ width: px }}>
                  {num(i + 1)}
                </b>
              ))}
            </div>
          </div>
          {tracks.map((t, i) => (
            <div
              key={t.id}
              data-track={t.id}
              className={'track-row ' + (activeTrack?.id === t.id ? 'chosen-track' : '')}
            >
              <div className="track-label">
                <button onClick={() => setTrack(t.id)}>
                  <small>TR {num(i + 1)}</small>
                  <strong>{t.name}</strong>
                </button>
                <Menu
                  label={'Opzioni traccia ' + t.name}
                  items={[
                    {
                      name: 'Rinomina traccia',
                      action: () =>
                        s.ask('Rinomina traccia', t.name, (v) =>
                          s.edit((p) => {
                            p.tracks[i].name = v
                          }),
                        ),
                    },
                    {
                      name: 'Sposta su',
                      disabled: !i,
                      action: () =>
                        s.edit((p) => p.tracks.splice(i - 1, 0, p.tracks.splice(i, 1)[0])),
                    },
                    {
                      name: 'Sposta giù',
                      disabled: i === tracks.length - 1,
                      action: () =>
                        s.edit((p) => p.tracks.splice(i + 1, 0, p.tracks.splice(i, 1)[0])),
                    },
                    {
                      name: 'Duplica traccia',
                      action: () =>
                        s.edit((p) =>
                          p.tracks.splice(i + 1, 0, {
                            ...structuredClone(t),
                            id: uid(),
                            name: t.name + ' · copia',
                            clips: t.clips.map((c) => ({ ...c, id: uid() })),
                          }),
                        ),
                    },
                    {
                      name: 'Elimina traccia',
                      action: () =>
                        s.confirm('Eliminare la traccia e le sue clip?', () =>
                          s.edit((p) => p.tracks.splice(i, 1)),
                        ),
                    },
                  ]}
                />
              </div>
              <div
                className="track-lane"
                style={{
                  width,
                  backgroundSize: px / (BAR / (snap === 1 ? STEP : snap)) + 'px 100%',
                }}
                onClick={(e) => {
                  if (e.target !== e.currentTarget) return
                  setTrack(t.id)
                  setSel([])
                  seek(
                    snapTo(
                      ((e.clientX - e.currentTarget.getBoundingClientRect().left) / px) * BAR,
                      e.altKey,
                    ),
                  )
                }}
                onDoubleClick={(e) => {
                  if (e.target === e.currentTarget)
                    insert(
                      patternClip(
                        s.pt.id,
                        snapTo(
                          ((e.clientX - e.currentTarget.getBoundingClientRect().left) / px) * BAR,
                          e.altKey,
                        ),
                      ),
                      t.id,
                    )
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const at = snapTo(
                      ((e.clientX - e.currentTarget.getBoundingClientRect().left) / px) * BAR,
                      e.altKey,
                    ),
                    sample = s.sounds.find(
                      (x) => x.id === e.dataTransfer.getData('oneiric/sound'),
                    )
                  if (sample) void addSounds([sample], at, t.id).catch((e) => s.notify(e.message))
                  else
                    void s.loadFiles(
                      [...e.dataTransfer.files],
                      (a) => void addSounds(a, at, t.id).catch((e) => s.notify(e.message)),
                    )
                }}
              >
                {t.clips.map((c) => {
                  const sound = s.sounds.find((x) => x.id === c.ref),
                    pt = s.p.patterns.find((x) => x.id === c.ref),
                    length = clipTicks(c, s.p),
                    selected = sel.includes(c.id),
                    buf = bank.buffers.get(c.ref),
                    dragKind = drag.current?.kind,
                    dx = selected ? delta : 0
                  return (
                    <button
                      key={c.id}
                      className={'arr-clip ' + c.type + (selected ? ' sel' : '')}
                      aria-label={
                        (pt?.name ?? sound?.name ?? 'Clip') +
                        ' · battuta ' +
                        (Math.floor(c.at / BAR) + 1)
                      }
                      style={{
                        left:
                          ((c.at + (dragKind === 'move' || dragKind === 'left' ? dx : 0)) / BAR) *
                          px,
                        width: Math.max(
                          5,
                          ((length +
                            (dragKind === 'left' ? -dx : dragKind === 'right' ? dx : 0)) /
                            BAR) *
                            px -
                            2,
                        ),
                      }}
                      onPointerDown={(e) => down(e, c, i, 'move')}
                      onPointerMove={move}
                      onPointerUp={up}
                      onPointerCancel={() => {
                        drag.current = null
                        setDelta(0)
                      }}
                      onClick={(e) => {
                        if (e.detail === 0) {
                          setSel([c.id])
                          setTrack(t.id)
                        }
                      }}
                      onDoubleClick={() => {
                        if (pt) {
                          s.setPattern(pt.id)
                          s.notify(pt.name + ' selezionato per la modifica')
                        } else showProps(true)
                      }}
                    >
                      <strong>
                        {c.type === 'audio' ? <Music2 size={11} /> : <Layers size={11} />}{' '}
                        {pt?.name ?? sound?.name ?? 'Audio'}
                      </strong>
                      {c.type === 'audio' ? (
                        <>
                          <Wave
                            sound={sound}
                            width={240}
                            height={20}
                            offset={c.offset / (buf?.duration ?? 1)}
                            fraction={c.duration / (buf?.duration ?? c.duration)}
                            color="#baace9"
                          />
                          <i
                            className="trim left"
                            title="Taglia inizio"
                            onPointerDown={(e) => down(e, c, i, 'left')}
                          />
                          <i
                            className="trim right"
                            title="Taglia fine"
                            onPointerDown={(e) => down(e, c, i, 'right')}
                          />
                        </>
                      ) : (
                        <span className="clip-notes">
                          {pt?.notes.map((n) => (
                            <i
                              key={n.id}
                              style={{
                                left: (n.at / length) * 100 + '%',
                                width: Math.max(1, (n.length / length) * 85) + '%',
                                top:
                                  (n.step
                                    ? s.p.channels.findIndex((x) => x.id === n.ch) % 4
                                    : 3 - (n.pitch % 4)) *
                                    21 +
                                  '%',
                              }}
                            />
                          ))}
                        </span>
                      )}
                    </button>
                  )
                })}
                <i
                  className="playhead"
                  style={{ left: ((s.playing && s.mode === 'song' ? s.pos : cursor) / BAR) * px }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="editor-toolbar clip-tools">
        <IconButton label="Copia clip" disabled={!selection.length} onClick={copy}>
          <Copy size={15} />
        </IconButton>
        <IconButton
          label="Incolla clip"
          disabled={!clipboard.length}
          onClick={() => paste(clipboard, cursor, Math.max(0, tracks.indexOf(activeTrack)))}
        >
          <Clipboard size={15} />
        </IconButton>
        <IconButton label="Duplica clip" disabled={!selection.length} onClick={duplicate}>
          <CopyPlus size={15} />
        </IconButton>
        <IconButton label="Elimina clip" disabled={!selection.length} onClick={remove}>
          <Trash2 size={15} />
        </IconButton>
        <button disabled={one?.clip.type !== 'pattern'} onClick={unique}>
          <Layers size={14} />
          Rendi unica
        </button>
        <button disabled={one?.clip.type !== 'audio'} onClick={split}>
          <Scissors size={14} />
          Dividi
        </button>
        <IconButton
          label="Proprietà clip audio"
          disabled={one?.clip.type !== 'audio'}
          onClick={() => showProps(true)}
        >
          <Settings2 size={15} />
        </IconButton>
      </div>
      <div className="range-controls">
        <button
          className={region ? 'active' : ''}
          onClick={() => {
            setRegion(!region)
            s.setMode('song')
          }}
        >
          <Repeat2 size={15} />
          Loop intervallo
        </button>
        <label>
          Da battuta
          <input
            aria-label="Prima battuta"
            type="number"
            min="1"
            value={s.p.range[0] / BAR + 1}
            onChange={(e) => addRange(0, +e.target.value)}
          />
        </label>
        <label>
          a
          <input
            aria-label="Ultima battuta inclusa"
            type="number"
            min="1"
            value={s.p.range[1] / BAR}
            onChange={(e) => addRange(1, +e.target.value)}
          />
        </label>
      </div>
      <div className="editor-hint">
        Clic sul righello per posizionarti · Maiusc per selezionare più clip · Trascina qui i WAV
      </div>
      <input
        type="file"
        hidden
        multiple
        accept=".wav"
        ref={input}
        onChange={(e) => {
          void s.loadFiles(
            [...(e.target.files ?? [])],
            (a) => void addSounds(a, cursor).catch((e) => s.notify(e.message)),
          )
          e.target.value = ''
        }}
      />
      {props && one?.clip.type === 'audio' && (
        <Modal title="Proprietà clip audio" close={() => showProps(false)}>
          <p>{s.sounds.find((x) => x.id === one.clip.ref)?.name}</p>
          <Range
            label="Taglio iniziale (s)"
            value={one.clip.offset}
            max={Math.max(0, one.clip.offset + one.clip.duration - 0.005)}
            step={0.001}
            change={(v) => {
              const d = clamp(v - one.clip.offset, -one.clip.at / tps, one.clip.duration - 0.005)
              editClip({
                offset: one.clip.offset + d,
                at: one.clip.at + d * tps,
                duration: one.clip.duration - d,
              })
            }}
          />
          <Range
            label="Durata (s)"
            value={one.clip.duration}
            min={0.005}
            max={
              (bank.buffers.get(one.clip.ref)?.duration ?? one.clip.duration) - one.clip.offset
            }
            step={0.001}
            change={(duration) => editClip({ duration })}
          />
          <Range
            label="Dissolvenze (s)"
            value={one.clip.fade}
            max={Math.min(0.5, one.clip.duration / 2)}
            step={0.001}
            change={(fade) => editClip({ fade })}
          />
        </Modal>
      )}
    </section>
  )
}
