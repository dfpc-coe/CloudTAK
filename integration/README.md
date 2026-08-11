# CloudTAK QA

End-to-end tests for CloudTAK using [Playwright](https://playwright.dev/), run against a live remote instance.

## Setup

```sh
npm install
npx playwright install chromium
cp .env.example .env   # then fill in the instance URL + credentials
```

## Structure

| Path                   | Purpose                                                                 |
| ---------------------- | ----------------------------------------------------------------------- |
| `playwright.config.ts` | Loads `.env`, sets the `baseURL`, and wires the auth setup project       |
| `lib/env.ts`           | Typed accessors for required environment variables                       |
| `pages/`               | Page Objects (`LoginPage`, `MapPage`)                                    |
| `tests/auth.setup.ts`  | Logs in through the UI once and saves the session to `.auth/user.json`   |
| `tests/*.spec.ts`      | Test specs - all run pre-authenticated via the saved storage state       |

## Running

```sh
npm test               # headless run
npm run test:headed    # watch the browser
npm run test:ui        # Playwright UI mode
npm run report         # open the last HTML report
```

Authentication runs once per invocation (the `setup` project) and every spec reuses
the saved storage state, so individual tests start already logged in.

## Conventions

- New views get a Page Object in `pages/` - keep selectors and waits there, not in specs.
- The map view is "loaded" only once the `Loading Map State` modal clears - use
  `MapPage.waitUntilLoaded()` rather than waiting on the canvas alone.
- Secrets live only in `.env` (gitignored) - never hardcode credentials in specs.
