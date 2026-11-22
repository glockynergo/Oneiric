import {
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  Headphones,
  Layers2,
  Plus,
  Repeat2,
  Settings2,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useState } from 'react'
import { bank, engine } from './audio'
import { BAR, channel, db, note, num, pat, STEP, uid, type Channel, type Sound } from './model'
import { IconButton, Menu, Modal, Range, SoundIcon, Wave, type Studio } from './ui'
export function Patterns({ s }: { s: Studio }) {
  const duplicate = () => {
    const pt = structuredClone(s.pt)
    pt.id = uid()
    pt.name += ' · copia'
    s.edit((p) => p.patterns.push(pt))
    s.setPattern(pt.id)
  }
  return (
    <div className="pattern-tools">
      <Layers2 size={15} />
      <select
        aria-label="Pattern attivo"
        value={s.pt.id}
        onChange={(e) => s.setPattern(e.target.value)}
      >
        {s.p.patterns.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <Menu
        label="Gestisci pattern"
        items={[
          {
            name: 'Nuovo pattern',
            action: () =>
              s.ask('Nuovo pattern', 'Pattern ' + num(s.p.patterns.length + 1), (v) => {
                const p = pat(v)
                s.edit((x) => x.patterns.push(p))
                s.setPattern(p.id)
              }),
          },
          {
            name: 'Rinomina pattern',
            action: () =>
              s.ask('Rinomina pattern', s.pt.name, (v) =>
                s.edit((p) => {
                  p.patterns.find((t) => t.id === s.pt.id)!.name = v
                }),
              ),
          },
          { name: 'Duplica pattern', action: duplicate },
          {
            name: 'Duplica battuta',
            disabled: s.pt.bars >= 64,
            action: () =>
              s.edit((p) => {
                const pt = p.patterns.find((t) => t.id === s.pt.id)!
                const a = s.bar * BAR
                const notes = pt.notes
                  .filter((n) => n.at >= a && n.at < a + BAR)
                  .map((n) => ({ ...n, id: uid(), at: n.at + BAR }))
                pt.notes.forEach((n) => {
                  if (n.at >= a + BAR) n.at += BAR
                })
                pt.notes.push(...notes)
                pt.bars++
              }),
          },
          {
            name: 'Lunghezza in battute',
            action: () =>
              s.ask('Lunghezza del pattern (1–64)', String(s.pt.bars), (v) => {
                const bars = Number(v)
                if (!Number.isInteger(bars) || bars < 1 || bars > 64)
                  return s.notify('Inserisci da 1 a 64 battute.')
                const change = () =>
                  s.edit((p) => {
                    const pt = p.patterns.find((t) => t.id === s.pt.id)!
                    pt.bars = bars
                    pt.notes = pt.notes.filter((n) => n.at < bars * BAR)
                  })
                if (s.pt.notes.some((n) => n.at >= bars * BAR))
                  s.confirm('Rimuovere le note oltre la nuova lunghezza?', change)
                else change()
              }),
          },
          {
            name: 'Elimina pattern',
            disabled: s.p.patterns.length === 1,
            action: () =>
              s.confirm('Eliminare il pattern e le sue clip?', () =>
                s.edit((p) => {
                  p.patterns = p.patterns.filter((pt) => pt.id !== s.pt.id)
                  p.tracks.forEach(
                    (t) =>
                      (t.clips = t.clips.filter(
                        (c) => c.type !== 'pattern' || c.ref !== s.pt.id,
                      )),
                  )
                }),
              ),
          },
        ]}
      />
    </div>
  )
}
export function channelItems(s: Studio, c: Channel) {
  const idx = s.p.channels.findIndex((x) => x.id === c.id)
  const reorder = (n: number) =>
    s.edit((p) => {
      p.channels.splice(idx + n, 0, p.channels.splice(idx, 1)[0])
    })
  return [
    {
      name: 'Rinomina canale',
      action: () =>
        s.ask('Rinomina canale', c.name, (v) =>
          s.edit((p) => {
            p.channels[idx].name = v
          }),
        ),
    },
    { name: 'Sposta su', disabled: idx === 0, action: () => reorder(-1) },
    { name: 'Sposta giù', disabled: idx === s.p.channels.length - 1, action: () => reorder(1) },
    {
      name: 'Duplica canale',
      action: () => {
        const id = uid()
        s.edit((p) => {
          p.channels.splice(idx + 1, 0, { ...c, id, name: c.name + ' · copia' })
          p.patterns.forEach((pt) =>
            pt.notes.push(
              ...pt.notes.filter((n) => n.ch === c.id).map((n) => ({ ...n, id: uid(), ch: id })),
            ),
          )
        })
        s.setChannel(id)
      },
    },
    {
      name: 'Elimina canale',
      action: () =>
        s.confirm('Eliminare ' + c.name + ' e le sue note?', () =>
          s.edit((p) => {
            p.channels.splice(idx, 1)
            p.patterns.forEach((pt) => (pt.notes = pt.notes.filter((n) => n.ch !== c.id)))
          }),
        ),
    },
  ]
}
export function Drums({ s }: { s: Studio }) {
  const [velocity, setVelocity] = useState<{ ch: string; at: number } | null>(null),
    [adding, add] = useState(false)
  const selectedBar =
    s.playing && s.mode === 'pattern' ? Math.floor(s.pos / BAR) % s.pt.bars : s.bar
  const hit = (c: Channel, n: number) => {
    s.setChannel(c.id)
    const at = selectedBar * BAR + n * STEP
    s.edit((p) => {
      const pt = p.patterns.find((a) => a.id === s.pt.id)!,
        old = pt.notes.find((x) => x.ch === c.id && x.at === at && x.step)
      if (old) pt.notes = pt.notes.filter((x) => x.id !== old.id)
      else pt.notes.push(note(c, at))
    })
  }
  const changeSample = (c: Channel, sound: Sound) => {
    bank
      .load(new OfflineAudioContext(1, 1, 44100), sound)
      .then(() =>
        s.edit((p) => {
          const ch = p.channels.find((x) => x.id === c.id)
          if (ch) ch.sample = sound.id
        }),
      )
      .catch((e) => s.notify(e.message))
  }
  return (
    <section className="panel sequencer">
      <div className="panel-head">
        <div className="panel-titles">
          <span className="section-icon">
            <Grid2X2 size={18} />
          </span>
          <h2>Step Sequencer</h2>
        </div>
        <Patterns s={s} />
      </div>
      <div className="seq-meta">
        <span>
          <i className="tiny-led" />
          Griglia a 16 step
        </span>
        <div>
          <IconButton
            label="Battuta precedente"
            disabled={!s.bar}
            onClick={() => s.setBar(s.bar - 1)}
          >
            <ChevronLeft size={13} />
          </IconButton>
          <span>
            Battuta <b>{num(selectedBar + 1)}</b> / {num(s.pt.bars)}
          </span>
          <IconButton
            label="Battuta successiva"
            disabled={s.bar + 1 >= s.pt.bars}
            onClick={() => s.setBar(s.bar + 1)}
          >
            <ChevronRight size={13} />
          </IconButton>
        </div>
      </div>
      <div className="seq-scroll">
        <div className="seq-table">
          <div className="seq-line ruler">
            <div className="channel-label">CANALE</div>
            <div className="stepgrid">
              {Array.from({ length: 16 }, (_, i) => (
                <span key={i} className={i % 4 === 0 ? 'beat-number' : ''}>
                  {num(i + 1)}
                </span>
              ))}
            </div>
            <span />
          </div>
          {s.p.channels.map((c, i) => {
            const sound = s.sounds.find((x) => x.id === c.sample),
              active = s.c?.id === c.id
            return (
              <div
                key={c.id}
                className={
                  'seq-line seq-channel ' +
                  (active ? 'selected-channel ' : '') +
                  (c.mute ? 'muted' : '')
                }
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const sample = s.sounds.find(
                    (x) => x.id === e.dataTransfer.getData('oneiric/sound'),
                  )
                  if (sample) changeSample(c, sample)
                  else
                    void s.loadFiles([...e.dataTransfer.files], (a) => {
                      if (a[0]) changeSample(c, a[0])
                    })
                }}
              >
                <button className="channel-name" onClick={() => s.setChannel(c.id)}>
                  <span className={'led ' + (c.mute ? 'off' : '')} />
                  <SoundIcon cat={sound?.category} />
                  <span>
                    <strong>{c.name}</strong>
                    <small>
                      CH {num(i + 1)}
                      <i /> {sound?.category ?? 'Audio'}
                    </small>
                  </span>
                </button>
                <div className="stepgrid">
                  {Array.from({ length: 16 }, (_, n) => {
                    const at = selectedBar * BAR + n * STEP,
                      hitOn = s.pt.notes.find((x) => x.ch === c.id && x.at === at && x.step),
                      current = s.playing && Math.floor(s.pos / STEP) % 16 === n
                    return (
                      <button
                        key={n}
                        title={c.name + ' · step ' + (n + 1) + ' · Clic destro per velocity'}
                        aria-label={c.name + ' step ' + (n + 1)}
                        aria-pressed={!!hitOn}
                        className={
                          'step ' +
                          (Math.floor(n / 4) % 2 ? 'alt ' : '') +
                          (hitOn ? 'on ' : '') +
                          (current ? 'current' : '')
                        }
                        style={hitOn ? { opacity: 0.6 + hitOn.v * 0.4 } : undefined}
                        onClick={() => hit(c, n)}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          if (hitOn) setVelocity({ ch: c.id, at })
                        }}
                      />
                    )
                  })}
                </div>
                <Menu label={'Opzioni ' + c.name} items={channelItems(s, c)} />
              </div>
            )
          })}
        </div>
      </div>
      <div className="seq-foot">
        <button className="ghost dashed" onClick={() => add(true)}>
          <Plus size={15} />
          Aggiungi canale
        </button>
        <span>
          {s.p.channels.length} canali <i /> {s.pt.bars * 16} step
        </span>
      </div>
      {velocity && (
        <Modal title="Velocity del colpo" close={() => setVelocity(null)}>
          <Range
            label="Velocity"
            value={
              s.pt.notes.find((n) => n.ch === velocity.ch && n.at === velocity.at && n.step)?.v ??
              1
            }
            min={0.01}
            change={(v) =>
              s.edit((p) => {
                const n = p.patterns
                  .find((pt) => pt.id === s.pt.id)!
                  .notes.find((n) => n.ch === velocity.ch && n.at === velocity.at && n.step)
                if (n) n.v = v
              })
            }
          />
        </Modal>
      )}
      {adding && (
        <Modal title="Aggiungi canale" close={() => add(false)}>
          <div className="sample-picker">
            {s.sounds.map((x) => (
              <button
                key={x.id}
                onClick={async () => {
                  try {
                    await bank.load(await engine.ready(), x)
                    const c = channel(x)
                    s.edit((p) => p.channels.push(c))
                    s.setChannel(c.id)
                    add(false)
                  } catch (e) {
                    s.notify((e as Error).message)
                  }
                }}
              >
                <SoundIcon cat={x.category} />
                {x.name}
                <small>{x.category}</small>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </section>
  )
}
export function Inspector({ s }: { s: Studio }) {
  const [settings, setSettings] = useState(false)
  const c = s.c
  if (!c) return null
  const sound = s.sounds.find((x) => x.id === c.sample),
    idx = s.p.channels.findIndex((x) => x.id === c.id)
  const patch = (values: Partial<Channel>) =>
    s.edit((p) =>
      Object.assign(
        p.channels.find((x) => x.id === c.id)!,
        values,
      ),
    )
  return (
    <section className="panel inspector">
      <div className="ins-head">
        <div className="mini-label">
          <SlidersHorizontal size={14} />
          ISPETTORE CANALE
        </div>
        <span className="ch-tag">CH {num(idx + 1)}</span>
        <IconButton label="Impostazioni sampler" onClick={() => setSettings(true)}>
          <Settings2 size={16} />
        </IconButton>
      </div>
      <div className="ins-body">
        <div className="sample-info">
          <div className="sample-title">
            <SoundIcon cat={sound?.category} />
            <div>
              <strong>{c.name}</strong>
              <small>
                {sound?.name ?? 'Sample mancante'}
                <span className="extension">.wav</span>
              </small>
            </div>
          </div>
          <div className="ins-wave">
            <Wave sound={sound} width={285} height={32} color="#65c7df" />
          </div>
        </div>
        <div className="ins-knobs">
          <Knob
            label="Volume"
            value={c.volume}
            min={0}
            max={1.25}
            display={db(c.volume)}
            change={(volume) => patch({ volume })}
          />
          <Knob
            label="Pan"
            value={c.pan}
            min={-1}
            max={1}
            display={
              c.pan === 0
                ? 'Centro'
                : Math.round(Math.abs(c.pan) * 100) + ' ' + (c.pan < 0 ? 'L' : 'R')
            }
            change={(pan) => patch({ pan })}
          />
        </div>
        <div className="ins-mode">
          <small>Riproduzione</small>
          <label className="mode-select">
            <Repeat2 size={14} />
            <select
              value={c.mode}
              aria-label="Modalità sampler"
              onChange={(e) => patch({ mode: e.target.value as Channel['mode'] })}
            >
              <option value="one">One-shot</option>
              <option value="gate">Durata nota</option>
            </select>
          </label>
        </div>
        <div className="mute-controls">
          <button className={c.mute ? 'active' : ''} onClick={() => patch({ mute: !c.mute })}>
            {c.mute ? <VolumeX size={14} /> : <Volume2 size={14} />}Mute
          </button>
          <button className={c.solo ? 'active' : ''} onClick={() => patch({ solo: !c.solo })}>
            <Headphones size={14} />
            Solo
          </button>
        </div>
      </div>
      {settings && (
        <Modal title={'Sampler · ' + c.name} close={() => setSettings(false)}>
          <label className="form-field">
            Sample assegnato
            <select
              value={c.sample}
              onChange={async (e) => {
                const x = s.sounds.find((x) => x.id === e.target.value)!
                try {
                  await bank.load(await engine.ready(), x)
                  patch({ sample: x.id })
                } catch (err) {
                  s.notify((err as Error).message)
                }
              }}
            >
              {s.sounds.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <Range
            label="Nota di riferimento MIDI"
            value={c.root}
            min={0}
            max={127}
            step={1}
            change={(root) => patch({ root })}
          />
          <Range
            label="Intonazione (semitoni)"
            value={c.tune}
            min={-24}
            max={24}
            step={0.1}
            change={(tune) => patch({ tune })}
          />
          <Range
            label="Inizio sample"
            value={c.start}
            max={c.end - 0.005}
            step={0.001}
            change={(start) => patch({ start })}
          />
          <Range
            label="Fine sample"
            value={c.end}
            min={c.start + 0.005}
            step={0.001}
            change={(end) => patch({ end })}
          />
          <Range
            label="Dissolvenza (s)"
            value={c.fade}
            max={0.25}
            step={0.001}
            change={(fade) => patch({ fade })}
          />
          <label className="check">
            <input
              type="checkbox"
              checked={c.mono}
              onChange={(e) => patch({ mono: e.target.checked })}
            />
            Monofonia
          </label>
        </Modal>
      )}
    </section>
  )
}
function Knob({
  label,
  value,
  min,
  max,
  display,
  change,
}: {
  label: string
  value: number
  min: number
  max: number
  display: string
  change: (v: number) => void
}) {
  const f = (value - min) / (max - min)
  return (
    <div className="knob-control">
      <div
        className="knob"
        style={{
          background:
            'conic-gradient(from 225deg, #75cbe8 ' +
            270 * f +
            'deg, #344056 0deg 270deg, transparent 270deg)',
        }}
      >
        <span style={{ transform: 'rotate(' + (-135 + 270 * f) + 'deg)' }} />
        <input
          type="range"
          aria-label={label + ' canale'}
          title={label + ' · ' + display}
          min={min}
          max={max}
          step=".01"
          value={value}
          onChange={(e) => change(+e.target.value)}
        />
      </div>
      <div>
        <small>{label}</small>
        <b>{display}</b>
      </div>
    </div>
  )
}
