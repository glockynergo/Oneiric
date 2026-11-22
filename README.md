# Oneiric — prima build
Drum machine locale in React, TypeScript, Vite e Web Audio. Il demo Midnight Orbit usa quattro canali e una battuta da 16 step.

## Avvio su Windows
1. Installa Node.js 22 LTS o successivo con npm. Usa una versione recente di Edge o Chrome.
2. Estrai tutto lo ZIP. Apri la cartella che contiene **package.json**. Nella barra dell’indirizzo di Esplora file scrivi **cmd** e premi Invio.
3. Esegui i due comandi in ordine.

```bat
npm install
npm run dev
```

Apri http://127.0.0.1:5173 nel browser e lascia il terminale aperto. Per fermare Vite premi Ctrl+C nel terminale. Dopo l’installazione puoi lavorare offline. Per verificare TypeScript e generare la distribuzione esegui `npm run build`.

## Prova la drum machine
1. Premi Play. I quattro canali ripetono una battuta a 128 BPM. Clicca uno step e osserva la testina. Il clic destro su un colpo acceso apre la velocity.
2. Seleziona Lunar Kick usando il nome del canale. Importa il tuo kick da **Importa WAV** o trascinalo nella libreria.
3. Ascoltalo con un clic in File locali. Regola il volume Anteprima. Trascina il suono sulla riga Lunar Kick, oppure premi + in Anteprima. Il nome del canale, gli step, il pan e il volume si conservano. Il nome del nuovo sample compare nell’ispettore.
4. Cambia BPM e premi Invio. Premi Pausa, prendi nota della posizione e riparti. Stop deve fermare i suoni e riportare la testina a 01:01:01.
5. Dal menu del canale prova rinomina, spostamento e duplicazione. Dal menu Progetto puoi partire da un progetto vuoto o riaprire il demo.

Questa tappa presenta al centro lo Step Sequencer. Il pacchetto completo aggiunge Piano Roll, Timeline e Mixer. I 100 campioni PCM sono stati sintetizzati per Oneiric. La qualità timbrica, l’ascolto dell’anteprima durante il loop e la latenza del dispositivo si valutano sul PC di destinazione.
