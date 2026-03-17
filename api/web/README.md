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

### Customize configuration

See [Configuration Reference](https://cli.vuejs.org/config/).
