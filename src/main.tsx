import React, { useEffect, useState, useRef, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Moon,
  AudioWaveform,
  Play,
  Pause,
  Square,
  Repeat2,
  Music2,
  Grid2X2,
  AudioLines,
  SlidersHorizontal,
  Undo2,
  Redo2,
  Save,
  Download,
  FolderOpen,
  ChevronDown,
  Volume2,
  HardDrive,
  PanelLeft,
  Settings2,
  PenLine,
  Sparkles,
  Keyboard,
  Layers,
  LayoutList,
  ChevronRight,
  Check,
  Timer as Metronome,
  Clock3,
  CircleHelp,
  FileMusic,
  Headphones,
} from 'lucide-react'
import catalog from './catalog.json'
import {
  BAR,
  STEP,
  PPQ,
  createProject,
  num,
  songLength,
  clamp,
  type Project,
  type Sound,
  type Mode,
} from './model'
import { engine, bank, renderMix } from './audio'
import {
  serialize,
  openProject,
  download,
  autosave,
  recovery,
  importWave,
  waveFile,
} from './files'
import { type Studio, IconButton, Menu, Modal, Range } from './ui'
import Library from './Library'
import { Drums, Inspector } from './Drums'
import './style.css'
const kit: Sound[] = catalog
type Tab = 'Step Sequencer' | 'Piano Roll' | 'Timeline' | 'Mixer'
const tabs = [{ name: 'Step Sequencer' as Tab, Icon: Grid2X2 }]
function App() {
  const [p, setP] = useState(() => createProject(kit, true)),
    [initial, setInitial] = useState(p),
    [channelId, setChannel] = useState(p.channels[0]?.id),
    [patId, setPat] = useState(p.patterns[0].id),
    [mode, setMode] = useState<Mode>('pattern'),
    [tab, setTab] = useState<Tab>('Step Sequencer'),
    [bar, setBar] = useState(0),
    [lib, setLib] = useState(innerWidth >= 760),
    [loop, setLoop] = useState(true),
    [metro, setMetro] = useState(false),
    [region, setRegion] = useState(false),
    [tick, setTick] = useState(0),
    [playing, setPlaying] = useState(false),
    [toast, setToast] = useState(''),
    [dialog, setDialog] = useState(''),
    [input, setInput] = useState(''),
    [busy, setBusy] = useState(''),
    [outRange, setOutRange] = useState(false),
    [recovered, setRecovered] = useState<string>(),
    [missing, setMissing] = useState<string[]>([]),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [sink, setSink] = useState('default')
  const hist = useRef<Project[]>([]),
    future = useRef<Project[]>([]),
    current = useRef(p),
    action = useRef<(v: string) => void>(() => {}),
    notice = useRef(0),
    version = useRef(0),
    openRef = useRef<HTMLInputElement>(null),
    linkRef = useRef<HTMLInputElement>(null),
    linkId = useRef(''),
    loading = useRef(false)
  const pt = p.patterns.find((x) => x.id === patId) ?? p.patterns[0],
    c = p.channels.find((x) => x.id === channelId) ?? p.channels[0],
    sounds = [...kit, ...p.locals],
    dirty = p !== initial
  const notify = (m: string) => {
    setToast(m)
    clearTimeout(notice.current)
    notice.current = window.setTimeout(() => setToast(''), 4200)
  }
  const update = (v: Project) => {
    current.current = v
    version.current++
    setP(v)
  }
  const edit = (fn: (draft: Project) => void) => {
    const old = current.current,
      next = structuredClone(old)
    fn(next)
    hist.current.push(old)
    if (hist.current.length > 80) hist.current.shift()
    future.current = []
    update(next)
  }
  const undo = () => {
      const prev = hist.current.pop()
      if (prev) {
        future.current.push(current.current)
        update(prev)
      }
    },
    redo = () => {
      const next = future.current.pop()
      if (next) {
        hist.current.push(current.current)
        update(next)
      }
    }
  const ask = (title: string, value: string, fn: (s: string) => void) => {
    action.current = fn
    setInput(value)
    setDialog('text|' + title)
  }
  const confirm = (title: string, fn: () => void) => {
    action.current = fn
    setDialog('confirm|' + title)
  }
  const prepareReplace = (fn: () => void) =>
    dirty ? confirm('Sostituire il progetto con modifiche da salvare?', fn) : fn()
  const reset = (proj: Project, save = true) => {
    engine.stop()
    hist.current = []
    future.current = []
    update(proj)
    setInitial(save ? proj : structuredClone(proj))
    setPat(proj.patterns[0].id)
    setChannel(proj.channels[0]?.id)
    setBar(0)
    setMode('pattern')
    setTab('Step Sequencer')
    setMissing([])
    setRegion(false)
    setTick(0)
    setPlaying(false)
    setDialog('')
  }
  const load = async (text: string, restore = false) => {
    try {
      const result = await openProject(text, kit)
      reset(result.project, !restore)
      setMissing(result.missing)
      setRecovered(undefined)
      if (result.missing.length) setDialog('missing')
      else notify(restore ? 'Sessione recuperata' : 'Progetto aperto')
    } catch (e) {
      notify((e as Error).message)
    }
  }
  const loadFiles: Studio['loadFiles'] = async (files, after) => {
    const good: Sound[] = [],
      errors: string[] = []
    for (const f of files)
      try {
        good.push(await importWave(f))
      } catch (e) {
        errors.push((e as Error).message)
      }
    if (good.length) {
      edit((d) => d.locals.push(...good))
      after?.(good)
    }
    notify(
      [good.length ? good.length + ' WAV importati' : '', ...errors]
        .filter(Boolean)
        .join(' · ') || 'Seleziona un file WAV.',
    )
  }
  const toggle = async () => {
    if (engine.playing || loading.current) {
      engine.pause()
      loading.current = false
      setPlaying(false)
      return
    }
    loading.current = true
    try {
      await engine.play(current.current, mode, pt.id, [...kit, ...current.current.locals])
      setPlaying(engine.playing)
    } catch (e) {
      notify((e as Error).message)
    } finally {
      loading.current = false
    }
  }
  const stop = () => {
    engine.stop()
    loading.current = false
    setPlaying(false)
    setTick(0)
  }
  const save = async (name?: string) => {
    const src = current.current
    const next = name ? { ...src, name } : src
    try {
      const data = await serialize(next, [...kit, ...src.locals])
      download(new Blob([data], { type: 'application/json' }), next.name + '.oneiric')
      if (current.current === src) {
        if (name) {
          hist.current.push(src)
          future.current = []
          update(next)
        }
        setInitial(next)
      }
      notify('Progetto portatile scaricato')
    } catch (e) {
      notify((e as Error).message)
    }
  }
  const submitExport = async () => {
    const src = current.current
    setBusy('Rendering in corso…')
    try {
      const b = await renderMix(src, [...kit, ...src.locals], outRange ? src.range : undefined),
        { blob, clipped } = waveFile(b)
      download(blob, src.name + '.wav')
      setDialog('')
      notify(
        clipped
          ? 'WAV esportato con clipping. Riduci il volume master.'
          : 'Brano esportato in WAV',
      )
    } catch (e) {
      notify((e as Error).message)
    } finally {
      setBusy('')
    }
  }
  const setPattern = (id: string) => {
    setPat(id)
    setBar(0)
  }
  const studio: Studio = {
    p,
    edit,
    sounds,
    pt,
    c,
    setChannel,
    setPattern,
    mode,
    setMode,
    pos: tick,
    playing,
    notify,
    ask,
    confirm,
    loadFiles,
    bar: Math.min(bar, pt.bars - 1),
    setBar,
  }
  useEffect(() => {
    engine.loop = loop
    engine.metro = metro
    engine.region = region
    engine.configure(p, mode, pt.id)
  }, [p, mode, pt.id, loop, metro, region])
  useEffect(() => {
    let raf = 0,
      last = 0
    function paint(now: number) {
      if (now - last > 32) {
        setTick(engine.position())
        setPlaying(engine.playing)
        last = now
      }
      raf = requestAnimationFrame(paint)
    }
    raf = requestAnimationFrame(paint)
    return () => cancelAnimationFrame(raf)
  }, [])
  useEffect(() => {
    recovery()
      .then((v) => {
        if (v) {
          setRecovered(v)
          setDialog('recover')
        }
      })
      .catch(() => notify('Recupero locale non disponibile.'))
    const activate = () => {
      void engine.ready().catch(() => {})
      window.removeEventListener('pointerdown', activate)
    }
    window.addEventListener('pointerdown', activate)
    return () => window.removeEventListener('pointerdown', activate)
  }, [])
  const touched = useRef(false)
  useEffect(() => {
    if (!touched.current && !dirty) return
    touched.current = true
    const rev = version.current
    const t = setTimeout(async () => {
      try {
        if (!dirty) {
          await autosave(null)
          return
        }
        const data = await serialize(p, [...kit, ...p.locals])
        if (version.current === rev) await autosave(data)
      } catch {
        notify('Autosalvataggio non riuscito. Scarica il progetto con Salva.')
      }
    }, 850)
    return () => clearTimeout(t)
  }, [p, dirty])
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (
        document.querySelector('dialog[open]') ||
        (e.target instanceof HTMLElement &&
          e.target.closest('input,textarea,select,[contenteditable=true]'))
      )
        return
      if (e.code === 'Space') {
        e.preventDefault()
        if (!e.repeat) void toggle()
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', keys)
    return () => window.removeEventListener('keydown', keys)
  })
  const settings = async () => {
    try {
      await engine.ready()
      setDevices(
        ((await navigator.mediaDevices?.enumerateDevices()) ?? []).filter(
          (x) => x.kind === 'audiooutput',
        ),
      )
    } catch {}
    setDialog('settings')
  }
  const fileItems = [
    {
      name: 'Nuovo progetto',
      action: () => prepareReplace(() => reset(createProject(kit, false))),
    },
    { name: 'Apri progetto…', action: () => openRef.current?.click() },
    { name: 'Salva', action: () => void save() },
    { name: 'Salva con nome…', action: () => ask('Salva con nome', p.name, (v) => void save(v)) },
    { name: 'Riapri demo', action: () => prepareReplace(() => reset(createProject(kit, true))) },
    { name: 'Impostazioni audio', action: () => void settings() },
    { name: 'Guida rapida', action: () => setDialog('help') },
  ]
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-moon">
            <Moon size={30} strokeWidth={2.3} />
            <i>✦</i>
          </span>
          <span>ONEIRIC</span>
        </div>
        <span className="top-divider" />
        <Menu label="Menu progetto" items={fileItems}>
          <FolderOpen size={15} />
          Progetto
          <ChevronDown size={13} />
        </Menu>
        <div className="top-spacer" />
        <span className="save-state">
          <i className={dirty ? 'dirty' : ''} />
          {dirty ? 'Modifiche da salvare' : 'Progetto pronto'}
        </span>
        <div className="history">
          <IconButton label="Annulla" disabled={!hist.current.length} onClick={undo}>
            <Undo2 size={16} />
          </IconButton>
          <IconButton label="Ripristina" disabled={!future.current.length} onClick={redo}>
            <Redo2 size={16} />
          </IconButton>
        </div>
        <button className="save-btn" onClick={() => void save()}>
          <Save size={15} />
          Salva
        </button>
        <button className="export-btn" onClick={() => setDialog('export')}>
          <Download size={15} />
          Esporta WAV
        </button>
      </header>
      <div className="shell">
        {lib && <Library s={studio} close={() => setLib(false)} />}
        <main>
          <section className="project-banner">
            <div className="banner-content">
              <div className="project-label">
                <span className="project-dot" />
                {p.name === 'Midnight Orbit' ? 'PROGETTO DEMO' : 'PROGETTO'}
              </div>
              <div className="project-name">
                <h1>{p.name}</h1>
                <IconButton
                  label="Rinomina progetto"
                  onClick={() =>
                    ask('Rinomina progetto', p.name, (v) =>
                      edit((d) => {
                        d.name = v
                      }),
                    )
                  }
                >
                  <PenLine size={14} />
                </IconButton>
              </div>
              <div className="project-meta">
                <Layers size={13} />
                {p.patterns.length} pattern
                <i /> <SlidersHorizontal size={13} />
                {p.channels.length} canali
                <i />
                <Music2 size={13} />
                4/4
              </div>
            </div>
          </section>
          <div className="transport">
            <div className="transport-buttons">
              <IconButton
                label={playing ? 'Pausa' : 'Play'}
                className="play"
                onClick={() => void toggle()}
              >
                {playing ? (
                  <Pause size={17} fill="currentColor" />
                ) : (
                  <Play size={17} fill="currentColor" />
                )}
              </IconButton>
              <IconButton label="Stop" className="transport-square" onClick={stop}>
                <Square size={13} fill="currentColor" />
              </IconButton>
              <IconButton label="Loop" active={loop} onClick={() => setLoop(!loop)}>
                <Repeat2 size={18} />
              </IconButton>
            </div>
            <div className="position">
              <small>POSIZIONE</small>
              <strong>
                {num(Math.floor(tick / BAR) + 1)}
                <em>:</em>
                {num(Math.floor((tick % BAR) / PPQ) + 1)}
                <em>:</em>
                {num(Math.floor((tick % PPQ) / STEP) + 1)}
              </strong>
            </div>
            <label className="tempo">
              <small>BPM</small>
              <input
                key={p.bpm}
                aria-label="BPM"
                type="number"
                min="30"
                max="300"
                defaultValue={p.bpm}
                onBlur={(e) => {
                  const n = clamp(Math.round(+e.target.value || p.bpm), 30, 300)
                  e.target.value = String(n)
                  if (n !== p.bpm)
                    edit((d) => {
                      d.bpm = n
                    })
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                }}
              />
            </label>
            <IconButton label="Metronomo" active={metro} onClick={() => setMetro(!metro)}>
              <Metronome size={18} />
            </IconButton>
            <div className="mode-switch">
              <button
                className={mode === 'pattern' ? 'selected' : ''}
                onClick={() => setMode('pattern')}
              >
                Pattern
              </button>
              <button
                className={mode === 'song' ? 'selected' : ''}
                onClick={() => setMode('song')}
              >
                Brano
              </button>
            </div>
          </div>
          <nav className="workspace-tabs" aria-label="Editor">
            {!lib && (
              <IconButton label="Mostra libreria" onClick={() => setLib(true)}>
                <PanelLeft size={17} />
              </IconButton>
            )}
            {tabs.map(({ Icon, name }) => (
              <button
                className={tab === name ? 'current-tab' : ''}
                key={name}
                onClick={() => setTab(name)}
              >
                <Icon size={16} />
                {name}
              </button>
            ))}
            <span />
          </nav>
          {tab === 'Step Sequencer' && <Drums s={studio} />}
          {tab !== 'Mixer' && <Inspector s={studio} />}
        </main>
      </div>
      <footer>
        <span>
          <i className={'status-led ' + (playing ? 'running' : '')} />
          {playing ? 'In riproduzione' : 'Studio pronto'}
        </span>
        <span className="footer-center">
          <Headphones size={12} />
          Web Audio <i />{' '}
          {engine.ctx ? (engine.ctx.sampleRate / 1000).toLocaleString('it-IT') : '44,1'} kHz
        </span>
        <button onClick={() => setDialog('help')}>
          <Keyboard size={14} />
          Scorciatoie
        </button>
        <IconButton label="Impostazioni audio" onClick={() => void settings()}>
          <Settings2 size={13} />
        </IconButton>
      </footer>
      {toast && (
        <div role="status" className="toast">
          <AudioWaveform size={16} />
          {toast}
          <button aria-label="Chiudi messaggio" onClick={() => setToast('')}>
            ×
          </button>
        </div>
      )}
      <input
        hidden
        ref={openRef}
        type="file"
        accept=".oneiric,.json"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file)
            prepareReplace(() => {
              void file
                .text()
                .then((v) => load(v))
                .catch(() => notify('Impossibile leggere il progetto.'))
            })
        }}
      />
      <input
        hidden
        ref={linkRef}
        type="file"
        accept=".wav"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          try {
            const id = linkId.current,
              news = await importWave(f, id)
            edit((d) => {
              d.locals = d.locals.map((x) => (x.id === id ? news : x))
            })
            setMissing((m) => m.filter((v) => v !== id))
            notify('Sample ricollegato')
          } catch (err) {
            notify((err as Error).message)
          }
        }}
      />
      {dialog.startsWith('text|') && (
        <Modal title={dialog.slice(5)} close={() => setDialog('')}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!input.trim()) return
              setDialog('')
              action.current(input.trim())
            }}
          >
            <input
              aria-label="Valore"
              autoFocus
              value={input}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setInput(e.target.value)}
              required
              maxLength={100}
            />
            <button className="primary">Conferma</button>
          </form>
        </Modal>
      )}
      {dialog.startsWith('confirm|') && (
        <Modal title={dialog.slice(8)} close={() => setDialog('')}>
          <div className="dialog-actions">
            <button onClick={() => setDialog('')}>Annulla</button>
            <button
              className="primary"
              onClick={() => {
                setDialog('')
                action.current('')
              }}
            >
              Conferma
            </button>
          </div>
        </Modal>
      )}
      {dialog === 'export' && (
        <Modal
          title="Esporta WAV"
          close={() => {
            if (!busy) setDialog('')
          }}
        >
          <p>{p.name} · PCM stereo a 16 bit · 44,1 kHz</p>
          <label className="form-field">
            Estensione
            <select
              value={outRange ? 'range' : 'all'}
              onChange={(e) => setOutRange(e.target.value === 'range')}
            >
              <option value="all">Brano intero</option>
              <option value="range">Intervallo della timeline</option>
            </select>
          </label>
          <p>
            {Math.ceil((outRange ? p.range[1] - p.range[0] : songLength(p)) / BAR)} battute, più
            la coda dei suoni.
          </p>
          <button className="primary" disabled={!!busy} onClick={() => void submitExport()}>
            <Download size={15} />
            {busy || 'Esporta il brano'}
          </button>
        </Modal>
      )}
      {dialog === 'settings' && (
        <Modal title="Impostazioni audio" close={() => setDialog('')}>
          <Range
            label="Volume master"
            value={p.master}
            change={(master) =>
              edit((d) => {
                d.master = master
              })
            }
          />
          <label className="form-field">
            Uscita audio
            <select
              disabled={!engine.ctx || !('setSinkId' in engine.ctx)}
              value={sink}
              onChange={async (e) => {
                const v = e.target.value
                try {
                  await (
                    engine.ctx as AudioContext & { setSinkId: (id: string) => Promise<void> }
                  ).setSinkId(v === 'default' ? '' : v)
                  setSink(v)
                } catch {
                  notify('Uscita audio non disponibile.')
                }
              }}
            >
              <option value="default">Predefinita di sistema</option>
              {devices
                .filter((d) => d.deviceId && d.deviceId !== 'default')
                .map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || 'Uscita ' + (i + 1)}
                  </option>
                ))}
            </select>
          </label>
          {missing.length > 0 && (
            <button onClick={() => setDialog('missing')}>
              Ricollega sample mancanti ({missing.length})
            </button>
          )}
        </Modal>
      )}
      {dialog === 'recover' && (
        <Modal title="Recuperare la sessione?" close={() => setDialog('')}>
          <p>È disponibile una copia locale del progetto con le ultime modifiche.</p>
          <div className="dialog-actions">
            <button
              onClick={() => {
                setDialog('')
                void autosave(null)
                setRecovered(undefined)
              }}
            >
              Scarta copia
            </button>
            <button
              className="primary"
              onClick={() => {
                if (recovered) void load(recovered, true)
              }}
            >
              Recupera progetto
            </button>
          </div>
        </Modal>
      )}
      {dialog === 'missing' && (
        <Modal title="Sample da ricollegare" close={() => setDialog('')}>
          <p>Il progetto è aperto. Scegli il WAV corrispondente per ciascun sample mancante.</p>
          {missing.map((id) => (
            <button
              key={id}
              onClick={() => {
                linkId.current = id
                linkRef.current?.click()
              }}
            >
              Ricollega {sounds.find((x) => x.id === id)?.name ?? id}
            </button>
          ))}
        </Modal>
      )}
      {dialog === 'help' && (
        <Modal title="Guida rapida" close={() => setDialog('')}>
          <div className="help-list">
            <p>
              <kbd>Spazio</kbd>Play / Pausa
            </p>
            <p>
              <kbd>Ctrl Z</kbd>Annulla
            </p>
            <p>
              <kbd>Ctrl Shift Z</kbd>Ripristina
            </p>
            <p>
              <kbd>Ctrl S</kbd>Salva progetto
            </p>
            <p>
              <kbd>Clic destro</kbd>Velocity di uno step acceso
            </p>
          </div>
          <p>
            Ascolta un suono nella libreria con un clic. Trascinalo sul canale per sostituire il
            sample.
          </p>
        </Modal>
      )}
    </div>
  )
}
createRoot(document.getElementById('root')!).render(<App />)
