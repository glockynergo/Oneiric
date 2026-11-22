# Oneiric

Studio di produzione per beat che gira nel browser. **Premi Play** per ascoltare *Midnight Orbit*, un pattern di batteria a 128 BPM. In modalità **Brano** il demo ha già quattro battute in timeline. Da **Progetto → Nuovo progetto** puoi partire con una griglia vuota.

## Avvio su Windows

1. Installa Node.js 22 LTS o successivo, con npm. Usa Edge o Chrome aggiornato.
2. Scarica il progetto da GitHub con **Code → Download ZIP**, poi **Estrai tutto**. Apri la cartella che contiene `package.json`.
3. Nella barra dell’indirizzo di Esplora file scrivi `cmd` e premi Invio. Si apre il terminale nella cartella corretta.
4. Esegui i comandi qui sotto, uno alla volta.

```bat
npm install
npm run dev
```

Apri **http://127.0.0.1:5173/**. Lascia il terminale aperto mentre lavori. Con **Ctrl+C** fermi Vite. Alle aperture successive basta `npm run dev`. Il primo download delle dipendenze richiede Internet. App, font di sistema, immagini, audio, salvataggio ed export funzionano poi in locale.

Se la porta 5173 è occupata, chiudi la precedente istanza oppure avvia `npm run dev -- --port 5174` e usa l’indirizzo stampato. L’autosalvataggio del browser dipende dall’indirizzo e dalla porta.

Per controllare TypeScript e compilare la versione di distribuzione esegui `npm run build`. Puoi provarla con `npm run preview` all’indirizzo stampato da Vite.

## Le due build

- **v0.1.0** è la prima tappa, con la drum machine al centro. Il tag contiene sorgenti, kit e guida di avvio.
- **v1.0.0** comprende drum machine, Piano Roll, Timeline, Mixer, progetto portatile, recupero locale ed export del brano. Le build usano lo stesso formato di progetto.

## Prima prova in due minuti

1. Premi **Play** sul demo. Accendi lo step 2 di Lunar Kick e prova **Annulla**. Il clic destro su uno step acceso apre la velocity.
2. Seleziona il canale **Lunar Kick** cliccando sul nome. Usa **Importa WAV**, oppure trascina un file dal PC nella libreria. Il menu adiacente permette di scegliere una cartella nei browser compatibili.
3. Clicca sul suono in **File locali** per ascoltarlo sopra il loop. Regola il cursore **Volume anteprima**. Trascina il suono sulla riga del kick o premi **+** accanto al nome nell’anteprima. L’ispettore mostra il nuovo file sotto il nome originale del canale. Step, volume e pan si conservano.
4. Imposta **142 BPM** e premi Invio. Premi **Pausa** e osserva la posizione. Riparti, poi premi **Stop** per silenziare le voci e tornare a 01:01:01.
5. Prova **Metronomo**, **Loop**, **Mute** e **Solo**. Il menu **⋯** del canale consente di rinominare, spostare, duplicare o eliminare il canale. In **Progetto → Impostazioni audio** trovi master e uscite rese disponibili dal browser.

## Arrangia un beat completo

1. **Melodia.** Apri **Timeline**, aggiungi una traccia chiamata *Melodia*, poi premi **WAV** o trascina un file sulla corsia. Scegli **1/16** nella griglia. Trascina i bordi per tagliare oppure apri **Proprietà clip audio** per regolare taglio, durata e dissolvenze. Per dividere una clip, selezionala, posiziona il cursore sul righello e premi **Dividi**.
2. **Batteria e basso.** Nel sequencer programma la batteria, poi scegli **Aggiungi canale → Lunar 808**. Seleziona **Durata nota** nell’ispettore. La rotella del sampler apre nota di riferimento, intonazione, estremi del sample, dissolvenza e monofonia.
3. **Piano Roll.** Con il canale 808 selezionato, clicca sulla griglia per disegnare note. Trascina una nota per spostarla e il bordo destro per allungarla. Il clic destro la elimina. Usa **Maiusc+clic** per selezionarne più di una. La velocity agisce sulla selezione. **Alt** disattiva temporaneamente l’aggancio. I pulsanti ±8va cambiano il registro. Scegli la posizione di incolla sul righello del Piano Roll.
4. **Pattern e fill.** Dal menu **⋯** accanto al selettore di pattern prova **Duplica pattern**, **Lunghezza in battute** e **Duplica battuta**. In timeline posiziona il cursore sulla traccia e premi **+ Pattern** per inserire il pattern attivo. Più clip possono usare lo stesso pattern. Seleziona l’ultima clip del demo, premi **Rendi unica**, chiamala *Fill finale*, poi aggiungi un clap nello step 16 del nuovo pattern.
5. **Ripasso finale.** Seleziona **Brano**. In Timeline imposta **Da battuta 3 a 4** e attiva **Loop intervallo**. Gli estremi indicano la prima e l’ultima battuta incluse. Play parte dall’intervallo. Con loop disattivato la riproduzione effettua un passaggio. Per riavere il brano intero disattiva **Loop intervallo**.
6. **Mixer.** Regola i canali della batteria, l’808, la traccia della melodia e il master. In Brano i canali attraversano anche la traccia che ospita la clip pattern. Un meter segnala il livello, **CLIP** si accende sui picchi rilevati. Un clic azzera l’indicatore. Anteprima e metronomo hanno percorsi separati.
7. **Salvataggio portatile.** Premi **Salva**. Il file `.oneiric` contiene il modello, i dati dei WAV utilizzati e i WAV della libreria locale. Sposta o rinomina il WAV della melodia sul disco. Usa **Progetto → Apri progetto** e scegli il file scaricato. Verifica forma d’onda, fill, pan e volumi.
8. **Esportazione.** Scegli **Esporta WAV → Brano intero**, poi ripeti per l’intervallo. Il file è stereo PCM 16 bit a 44,1 kHz. L’export usa sempre la timeline e include la coda dei colpi. Le clip audio mantengono i loro tagli in secondi. Per esportare un pattern da un progetto vuoto, inseriscilo prima su una traccia.

Per copiare una selezione di clip o note, usa i pulsanti dell’editor oppure **Ctrl+C**, **Ctrl+V**, **Ctrl+D** e **Canc** nell’editor attivo. Trascina le clip per spostarle anche tra tracce. I pulsanti di zoom cambiano la scala temporale.

## Sessioni e file

**Spazio** attiva Play/Pausa fuori dai campi di testo. **Ctrl+Z** annulla, **Ctrl+Maiusc+Z** o **Ctrl+Y** ripristinano. La cronologia conserva fino a 80 modifiche. **Ctrl+S**, **Salva** e **Salva con nome** generano download. Il browser gestisce cartella e numerazione dei nomi ripetuti.

Dopo una breve pausa nelle modifiche, Oneiric scrive una copia di recupero in IndexedDB. Al riavvio offre di recuperarla. La quota disponibile e la navigazione privata dipendono dal browser. Il progetto portatile è la copia da conservare. Il browser può mostrare un avviso alla chiusura di un progetto modificato. Un progetto con un sample locale mancante si apre e propone il ricollegamento. Il comando resta disponibile nelle impostazioni audio.

## Suoni e struttura tecnica

I **100 WAV originali** sono sintetizzati per Oneiric, organizzati in Lunar Kit, Trap Nebula, Drill Eclipse e Boom Bap Atlas. I campioni sono mono PCM 16 bit a 44,1 kHz. Puoi usarli nelle tue produzioni. Night Arc Loop e Late Train Loop includono BPM e tonalità. L’immagine orbitale è generata per il progetto. Le icone sono Lucide, distribuite con licenza ISC nel pacchetto lucide-react.

- `src/model.ts` definisce canali, note, pattern, tracce e clip. Le posizioni usano 96 tick per quarto, 384 per battuta. Gli estremi dei WAV sono in secondi o in frazione del sample nel sampler.
- `src/audio.ts` compila gli eventi ed esegue il mix Web Audio. Lo scheduler pianifica circa 130 ms in anticipo a intervalli di 25 ms sul clock di AudioContext. La UI legge la posizione del motore. Il rendering offline condivide eventi, catena dei bus, inviluppi e pan.
- `src/files.ts` gestisce lettura WAV, serializzazione versionata, download, IndexedDB e codifica PCM. È il punto da adattare per l’accesso al disco in Electron.
- `src/Drums.tsx`, `Piano.tsx`, `Timeline.tsx`, `Mixer.tsx` e `Library.tsx` implementano gli editor React. Gli asset locali sono in `public/`.
- `vercel.json` configura una distribuzione statica Vite dalla radice della repo, con output `dist`. L’app distribuita continua a elaborare campioni e progetti nel browser.

## Verifiche eseguite

Entrambe le build superano il controllo TypeScript e la compilazione Vite. Nel browser Chrome della macchina di sviluppo ho provato Play, modifica della griglia, import WAV, anteprima e sostituzione del kick durante il loop, cambio BPM, pausa, ripresa e Stop. Ho inserito e rifilato una melodia, reso unica la quarta clip, aggiunto il fill, disegnato una nota di 808, riprodotto l’intervallo e regolato il mixer.

Ho scaricato il progetto, rinominato il WAV sorgente, riaperto il file portatile dalla UI ed esportato di nuovo. I due WAV Chrome hanno entrambi **304.012 campioni per canale**. Su 608.024 valori PCM interlacciati, otto differiscono di un’unità a 16 bit. Durata e bilanciamento coincidono entro la precisione misurata.

La prova automatica separata cattura i due canali del master in tempo reale su un’uscita virtuale e li confronta con OfflineAudioContext. Sul brano di prova la correlazione iniziale è 1,00000 e l’errore RMS relativo si arrotonda a 0,000000. Il confronto del rendering prima e dopo la riapertura ha differenza massima zero. La suite prova anche WAV illeggibili, ricollegamento, export dell’intervallo, coda finale, mute e rilettura PCM. Per ripeterla usa Node.js 22 LTS recente o successivo, dalla radice del progetto.

```bat
cd verifiche
npm ci
npm test
```

**Da verificare sul PC Windows:** qualità timbrica del kit, continuità percepita mentre cambi sample, latenza del dispositivo, differenze tra altoparlanti e cuffie e disponibilità delle uscite alternative. Il supporto WAV dipende dai codec del browser. I progetti e i render sono in memoria. File lunghi possono richiedere molta RAM. Una scheda in background o un PC sotto carico può ritardare lo scheduler.

## Roadmap

Swing, roll e choke group degli hi-hat. Scale, note fantasma e slide 808 nel Piano Roll. Time stretching dei loop, EQ, riverbero, automazioni e registrazione. In seguito, Electron per Windows con accesso al disco, kit persistenti, progetti recenti e installer. L’hosting VST3 richiederà una valutazione separata del motore e dell’isolamento dei plugin.
