# ATELIER—1111

An A1111-style workbench for frontier image models. Local-first, single user,
your own OpenRouter key. No auth, no credits, no hosting of weights.

Instrument-grade UI: six colours, zero radius, a 4px lattice, no shadows or
gradients, and one accent that only ever means *live*.

## Setup

```bash
npm install
npm start
```

Open http://127.0.0.1:5180 and add your key under **Settings** in the top bar.
Keys are issued at https://openrouter.ai/keys. On Windows, `Start-Atelier.vbs`
does the same with no console window and opens the browser.

`npm start` runs one process that serves the built UI and the API, and rebuilds
the UI only when the source has changed. `npm run dev` is for working on the
app itself: the API on 8788 behind the Vite dev server on 5180.

A `.env` file still works if you prefer it (`cp .env.example .env`), but it
isn't required — a key saved in the UI takes precedence.

## Local-first, your key

- **Everything stays on this machine.** Generations are written to
  `data/images` the moment the model answers, with prompt, parameters and cost
  in `data/atelier.db`. No tab has to stay open and a restart loses nothing.
- **The key is yours and stays put.** It lives in `data/settings.json`, is
  never sent to the browser, and only ever goes to openrouter.ai. The top bar
  shows what the key itself has left (or has spent today), read from
  OpenRouter's own ledger rather than estimated.
- **Only localhost can use it.** The server binds to 127.0.0.1 and refuses any
  other `Host` or any cross-site `Origin`, so a web page you visit cannot
  queue a generation or swap the key (DNS rebinding included).
- **Works offline apart from the API.** Fonts are bundled; the app makes no
  request to anyone but OpenRouter.
- **Moving from the browser-storage build** is automatic: on first load, any
  gallery that build left in the browser's IndexedDB is copied to disk and
  the browser copy removed.

## What it does

- **Model index** pulled live from OpenRouter (`?output_modalities=image`), so
  it never carries a stale hardcoded list. ~38 models including
  `google/gemini-3-pro-image` (Nano Banana Pro) and `openai/gpt-image-2`.
- **Model card** — the selected model heads the workspace with price, context
  window and release date beside it. Price shows the published per-token rate
  until you've actually run the model, then switches to your measured per-image
  average, with the published rate kept on hover.
- **Reference tray** — drop up to 8 images, or send a generated plate back in.
  Refs turn a prompt into an edit.
- **Persistent gallery** — every image keeps its prompt, model, parameters and
  cost in SQLite. *Use as reference* and *Reuse parameters* close the loop.
- **Per-parameter SEND switches** — `aspect_ratio`, `resolution`, `quality` and
  `output_format` support varies by model, so each one can be withheld from the
  request rather than guessed at. Upstream errors surface verbatim.

## How parameter support is reconciled

`aspect_ratio`, `resolution`, `quality` and `output_format` vary by model, and
**OpenRouter publishes nothing about them** — its `supported_parameters` covers
chat sampling (`temperature`, `top_p`, `seed`) and never mentions image
parameters. There is no table to read, so capability is *observed* rather than
declared, and recorded per `(model, parameter, value)` — a model may honour
`1:1` and `16:9` while silently dropping `21:9`.

There are two ways a parameter fails, and only one is loud:

| Verdict | What happened | How it's caught |
|---|---|---|
| `rejected` | API returned an error naming the parameter | Error text, matched against parameters actually sent |
| `ignored` | API returned 200 and quietly did something else | Decoding the returned bytes and comparing to the request |
| `ok` | Output matches the request | Same measurement |
| `accepted` | No error, but nothing observable to check (`quality`) | Stated as unverifiable rather than guessed |

The silent case is the dangerous one: it bills in full and looks like success.
It's detected by reading real width, height and format out of the PNG/JPEG/WebP
bytes and comparing against what was asked for.

On a loud rejection the server records the fact, strips the offending
parameter, and retries once — a parameter rejection is a 400, so nothing was
billed and the retry costs only latency. The job reports `Retried without
quality` and the value is withheld from future requests automatically.

Panel 04 shows each option's verdict for the selected model: struck through when
rejected, dotted when ignored, plain when untested. Nothing is colour-coded —
the verdict is spelled out beneath the control with its evidence.

## A note on pricing

OpenRouter quotes every rate **per token**, including `image_output` — the
field that governs what a generation costs. It is not a per-image price. For
`google/gemini-3-pro-image` it reads `0.00012`, which lands near its real
~$0.13 per image only after multiplying by the ~1,120 output tokens an image
consumes. Because that token count varies by model and resolution, the app
shows published rates as rates and shows per-image cost only where the API
measured it on a real run. It never multiplies the two to invent an estimate.

## Layout

```
server/
  index.js        bootstrap and listen
  paths.js        data directory resolution
  settings.js     API key storage, masking, verification
  openrouter.js   OpenRouter client
  library.js      the gallery on disk: save, adopt, remove, storage
  localonly.js    loopback Host/Origin guard
  queue.js        job runner, concurrency 2
  db/             connection + schema, jobs repo, images repo
  routes/         one router per resource
src/
  api.js          HTTP transport
  format.js       presentation helpers
  state/          useLibrary · useComposer · useSettings
  components/
    ui/           Plate · Param · Segmented
    controls/     one plate per control group
```

No module exceeds 150 lines. `App.jsx` is composition only; state lives in
`state/`, presentation in `components/`.

| Piece | Choice | Why |
|---|---|---|
| Store | `node:sqlite` (built into Node 22.5+) | No native module to compile |
| Images | `data/images/*.png` on disk | Blobs don't belong in SQLite |
| Jobs | In-process queue, concurrency 2 | Generation takes 5—30s; blocking HTTP is fragile |
| API | `POST /api/v1/images` | Dedicated endpoint; cleaner than the chat route |

## Key handling

The key is posted to the local API and written to `data/settings.json` at mode
`0600`. It is never returned over HTTP — responses carry a masked hint and a
source — and never touches browser storage. It is verified against OpenRouter
on save, after being written, so a verification outage can't lock you out.

`data/` is gitignored: database, images and settings all live there.

## Not built yet

- X/Y/Z comparison grid (`POST /api/generate` already takes a model list and
  creates one job per model, which is what the grid needs)
- Wildcards / dynamic prompts — `a {red|blue} cloak`
- Inpaint mask canvas
- Saved presets and styles

## License

MIT — see `LICENSE`. Bundled fonts keep their own licences: Departure Mono
(`public/fonts/OFL.txt`) and Archivo (via `@fontsource-variable/archivo`) are
both under the SIL Open Font License 1.1.
