# TAK-PS-Stats Web UI

## Project setup
```
npm install
```

### Compiles and hot-reloads for development
```
npm run serve
```

### Compiles and minifies for production
```
npm run build
```

### Lints and fixes files
```
npm run lint
```

### Generated TypeScript Definiton File

The WebUI TypeScript definitions are built directly from the Swagger output of the server.
With the server running locally on port 5001, run the following

```
npm run typegen
```

### Generate Plugin API docs

Generate TypeDoc output for the exported plugin API in `plugin.ts` with:

```
npm run doc
```

The generated HTML documentation is written to `dist/typedoc/`.
On tagged releases, the release workflow also deploys this output to GitHub Pages.

### Desktop app (Tauri demo)

`src-tauri/` wraps the same `dist/` bundle that Capacitor ships on Android and
iOS in a [Tauri 2](https://tauri.app) desktop shell. As on mobile, the first
run shows the Setup page and the chosen server URL is stored on the device.

Requires a Rust toolchain plus the
[Tauri system prerequisites](https://tauri.app/start/prerequisites/)
(`libwebkit2gtk-4.1-dev` and friends on Linux).

```
npm run desktop:dev     # Vite dev server inside the desktop window
npm run desktop:build   # installers under src-tauri/target/release/bundle
```

`File → Change Server URL` clears all stored data and returns to Setup.

### Customize configuration

See [Configuration Reference](https://cli.vuejs.org/config/).
