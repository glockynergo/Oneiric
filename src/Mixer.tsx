import { SlidersHorizontal, Volume2 } from 'lucide-react'
import { db, num, type Mix } from './model'
import { Meter, Range, type Studio } from './ui'
export default function Mixer({ s }: { s: Studio }) {
  const strip = (m: Mix, i: number, isTrack: boolean) => {
    const patch = (v: Partial<Mix>) =>
      s.edit((p) =>
        Object.assign(
          (isTrack ? p.tracks : p.channels).find((x) => x.id === m.id)!,
          v,
        ),
      )
    return (
      <div className="mix-strip" key={m.id}>
        <span className="mini-label">
          {isTrack ? 'TR' : 'CH'} {num(i + 1)}
        </span>
        <strong>{m.name}</strong>
        <Meter id={m.id} />
        <Range
          label={'Volume · ' + m.name}
          value={m.volume}
          max={1.25}
          display={db(m.volume)}
          change={(volume) => patch({ volume })}
        />
        <Range
          label={'Pan · ' + m.name}
          value={m.pan}
          min={-1}
          display={m.pan === 0 ? 'Centro' : Math.round(m.pan * 100) + '%'}
          change={(pan) => patch({ pan })}
        />
        <div className="mix-ms">
          <button
            className={m.mute ? 'active' : ''}
            onClick={() => patch({ mute: !m.mute })}
            aria-label={'Mute ' + m.name}
          >
            M
          </button>
          <button
            className={m.solo ? 'active' : ''}
            onClick={() => patch({ solo: !m.solo })}
            aria-label={'Solo ' + m.name}
          >
            S
          </button>
        </div>
      </div>
    )
  }
  return (
    <section className="panel mixer">
      <div className="panel-head">
        <div className="panel-titles">
          <SlidersHorizontal size={18} />
          <h2>Mixer</h2>
        </div>
        <span className="mini-label">STEREO</span>
      </div>
      <div className="master-strip">
        <Volume2 size={19} />
        <strong>Master</strong>
        <Range
          label="Volume master"
          value={s.p.master}
          max={1.25}
          display={db(s.p.master)}
          change={(v) =>
            s.edit((p) => {
              p.master = v
            })
          }
        />
        <Meter />
      </div>
      <h3>Canali pattern</h3>
      <div className="strips">{s.p.channels.map((c, i) => strip(c, i, false))}</div>
      <h3>Tracce del brano</h3>
      <div className="strips">{s.p.tracks.map((t, i) => strip(t, i, true))}</div>
    </section>
  )
}
