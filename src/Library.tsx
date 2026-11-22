import {
  ChevronDown,
  FolderInput,
  Headphones,
  Layers3,
  LibraryBig,
  Music2,
  PanelLeftClose,
  Play,
  Plus,
  Search,
  Star,
  Upload,
  Volume2,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { bank, engine } from './audio'
import { type Sound, channel } from './model'
import { IconButton, Menu, SoundIcon, type Studio, Wave } from './ui'
export default function Library({ s, close }: { s: Studio; close: () => void }) {
  const [local, setLocal] = useState(false),
    [query, setQuery] = useState(''),
    [kit, setKit] = useState('Lunar Kit'),
    [cat, setCat] = useState(''),
    [onlyFav, setOnly] = useState(false),
    [sel, setSel] = useState('kick-lunar'),
    [vol, setVol] = useState(engine.previewVolume),
    [drag, setDrag] = useState(false)
  const [favs, setFavs] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('oneiric-stars') ?? '[]')
    } catch {
      return []
    }
  })
  const input = useRef<HTMLInputElement>(null),
    folder = useRef<HTMLInputElement>(null),
    selected = s.sounds.find((x) => x.id === sel) ?? s.sounds[0]
  const list = s.sounds.filter(
    (x) =>
      Boolean(x.local) === local &&
      (!kit || local || query || x.kit === kit) &&
      (!cat || x.category === cat) &&
      (!onlyFav || favs.includes(x.id)) &&
      x.name.toLowerCase().includes(query.toLowerCase()),
  )
  const preview = (x: Sound) => {
    setSel(x.id)
    engine.preview(x).catch((e) => s.notify(e.message))
  }
  const assign = async (x: Sound) => {
    try {
      await bank.load(await engine.ready(), x)
      s.edit((p) => {
        const c = p.channels.find((c) => c.id === s.c?.id)
        if (c) c.sample = x.id
        else p.channels.push(channel(x))
      })
      s.notify(x.name + ' assegnato al canale')
    } catch (e) {
      s.notify((e as Error).message)
    }
  }
  const files = (fs: File[]) =>
    s.loadFiles(fs, (a) => {
      if (a.length) {
        setLocal(true)
        setQuery('')
        setCat('')
        setOnly(false)
        setSel(a[0].id)
      }
    })
  return (
    <aside
      className={'library ' + (drag ? 'drag-over' : '')}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          setDrag(true)
        }
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        void files([...e.dataTransfer.files])
      }}
    >
      <div className="lib-title">
        <LibraryBig size={19} />
        <h2>Libreria</h2>
        <IconButton label="Nascondi libreria" onClick={close}>
          <PanelLeftClose size={16} />
        </IconButton>
      </div>
      <div className="lib-tools">
        <div className="search">
          <Search size={15} />
          <input
            placeholder="Cerca suoni..."
            aria-label="Cerca suoni"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="lib-tabs">
          <button
            className={!local ? 'chosen' : ''}
            onClick={() => {
              setLocal(false)
              setCat('')
            }}
          >
            <Layers3 size={14} />
            Inclusi
          </button>
          <button
            className={local ? 'chosen' : ''}
            onClick={() => {
              setLocal(true)
              setCat('')
            }}
          >
            <FolderInput size={14} />
            File locali
          </button>
        </div>
      </div>
      <div className="lib-filters">
        <span className="mini-label">{local ? 'FILE LOCALI' : 'SUONI INCLUSI'}</span>
        <IconButton label="Solo preferiti" active={onlyFav} onClick={() => setOnly(!onlyFav)}>
          <Star size={14} fill={onlyFav ? 'currentColor' : 'none'} />
        </IconButton>
      </div>
      {!local && (
        <label className="kit-select">
          <div className="kit-art" />
          <span>
            <small>Kit selezionato</small>
            <strong>{kit || 'Tutti i kit'}</strong>
          </span>
          <ChevronDown size={14} />
          <select
            aria-label="Kit selezionato"
            value={kit}
            onChange={(e) => setKit(e.target.value)}
          >
            <option value="">Tutti i kit</option>
            {[...new Set(s.sounds.filter((x) => !x.local).map((x) => x.kit))].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
      )}
      <div className="cat-row">
        <select aria-label="Categoria" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Tutte le categorie</option>
          {[
            ...new Set(s.sounds.filter((x) => Boolean(x.local) === local).map((x) => x.category)),
          ].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <small>{list.length} suoni</small>
      </div>
      <div className="sound-list">
        {list.map((x) => (
          <div
            key={x.id}
            className={'sound-row ' + (selected.id === x.id ? 'selected' : '')}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('oneiric/sound', x.id)}
          >
            <button
              title={'Ascolta ' + x.name}
              onClick={() => preview(x)}
              onDoubleClick={() => void assign(x)}
            >
              <SoundIcon cat={x.category} />
              <span>{x.name}</span>
            </button>
            <button
              className={'fav ' + (favs.includes(x.id) ? 'starred' : '')}
              aria-label={'Preferito ' + x.name}
              onClick={() => {
                const f = favs.includes(x.id) ? favs.filter((id) => id !== x.id) : [...favs, x.id]
                setFavs(f)
                try {
                  localStorage.setItem('oneiric-stars', JSON.stringify(f))
                } catch {}
              }}
            >
              <Star size={13} />
            </button>
            <small>{x.category}</small>
          </div>
        ))}
        {!list.length && (
          <div className="empty-list">
            <Music2 size={22} />
            <p>
              {local && !s.p.locals.length ? 'Trascina qui i tuoi WAV' : 'Nessun suono trovato'}
            </p>
          </div>
        )}
      </div>
      <div className="lib-import">
        <button onClick={() => input.current?.click()}>
          <Upload size={15} />
          Importa WAV
        </button>
        <Menu
          label="Importa cartella"
          items={[{ name: 'Importa una cartella', action: () => folder.current?.click() }]}
        />
      </div>
      <input
        type="file"
        hidden
        multiple
        accept=".wav,audio/wav"
        ref={input}
        onChange={(e) => {
          void files([...(e.target.files ?? [])])
          e.target.value = ''
        }}
      />
      <input
        type="file"
        hidden
        multiple
        ref={(el) => {
          folder.current = el
          el?.setAttribute('webkitdirectory', '')
        }}
        onChange={(e) => {
          void files([...(e.target.files ?? [])].filter((f) => /\.wav$/i.test(f.name)))
          e.target.value = ''
        }}
      />
      <div className="preview-pane">
        <div className="mini-label">
          <Headphones size={13} />
          ANTEPRIMA
        </div>
        <div className="preview-name">
          <strong>{selected.name}</strong>
          <IconButton label="Assegna al canale selezionato" onClick={() => void assign(selected)}>
            <Plus size={15} />
          </IconButton>
        </div>
        {selected.bpm && (
          <small>
            {selected.bpm} BPM · {selected.key}
          </small>
        )}
        <div className="preview-visual">
          <IconButton label="Riproduci anteprima" onClick={() => preview(selected)}>
            <Play size={12} fill="currentColor" />
          </IconButton>
          <Wave sound={selected} color="#ae9eee" width={210} height={34} />
        </div>
        <div className="preview-vol">
          <Volume2 size={13} />
          <input
            aria-label="Volume anteprima"
            type="range"
            min="0"
            max="1"
            step=".01"
            value={vol}
            onChange={(e) => {
              setVol(+e.target.value)
              engine.setPreview(+e.target.value)
            }}
          />
          <small>{Math.round(vol * 100)}%</small>
        </div>
      </div>
    </aside>
  )
}
