# Atelier-1111

BYOK image and video generation for OpenRouter. It runs on your machine and
saves every result to disk with its prompt and cost.

![Atelier-1111 with a gallery of images from six models](docs/screenshot.webp)

## Run it

Needs Node.js 22.5 or later.

```bash
npm install
npm start
```

Open http://127.0.0.1:5180 and paste your OpenRouter key. You can get one at
https://openrouter.ai/keys. On Windows, you can double-click `Start-Atelier.vbs`
instead.

## What it does

- Lists every image and video model on OpenRouter.
- Takes up to 8 reference images for edits. Paste them, drop them, or send a
  result back in.
- Saves results to `data/images` and their details to `data/atelier.db`.
- Shows what each image cost and what your key has left.
- Tracks which settings each model honours. Values a model refuses are struck
  through, and values it ignores are dotted. Hover to see why.

## Your key

The key is stored in `data/settings.json` and is only sent to OpenRouter. The
browser never sees it. The server only answers requests from localhost, so
other websites can't use it.

You can also put `OPENROUTER_API_KEY` in a `.env` file (see `.env.example`). A
key saved in the app takes precedence.

## Development

`npm run dev` runs the API on port 8788 behind the Vite dev server on 5180.
`npm test` runs the tests.

## License

MIT. The bundled fonts, Departure Mono and Archivo, use the SIL Open Font
License 1.1.
