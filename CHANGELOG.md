# CHANGELOG

## Emoji Cheatsheet
- :pencil2: doc updates
- :bug: when fixing a bug
- :rocket: when making general improvements
- :white_check_mark: when adding tests
- :arrow_up: when upgrading dependencies
- :tada: when adding new features

## Version History

### v1.4.1 - 2024-04-15

- :bug: `UI` Avoid CloudTAK Init error if no basemap is configured

### v1.4.0 - 2024-04-15

- :rocket: `UI` Remove ARCGIS_TIMEZONE option now that config.timezone does the same thing generically

### v1.3.3 - 2024-04-15

- :rocket: Attempt to get GH Actions releaser to include CHANGESET entries

### v1.3.2 - 2024-04-15

- :rocket: Attempt to get GH Actions releaser to include CHANGESET entries

### v1.3.1 - 2024-04-15

- :rocket: Attempt to get GH Actions releaser to include CHANGESET entries

### v1.3.0 - 2024-04-15

- :rocket: `API` Data Sync CoTs are now diffed with existing CoTs to avoid duplicate pushes
- :bug: `API` Fix saving Profile information when location is not set
- :bug: `API` Gracefully handle when a weather API request fails
- :bug: `API` `UI` Fix creation of ESRI Sinks
- :rocket: `UI` Menus now scroll in place (overflow)
- :rocket: `UI` `API` Add support for sending CoT Data Packages
- :rocket: `UI` Updated Overlays panel

### v1.2.0

- :rocket: `DevOps` Update Build system to output to `dist/` instead of parallel for cleaner building
- :rocket: `API` Add Reverse Search service with Weather
- :rocket: `UI` Add Reverse Search context menu function
- :rocket: `UI` Add support for Query Pane w/ initial weather pane
- :bug: Fix Enum loading in Layer Environment
- :rocket: `API` Add backend support for `archived` tag
- :rocket: `UI` Move all Basemap Components to CloudTAK & add scope
- :rocket: `API` Automatic Schema Updates on layer change

### v1.1.0

- :rocket: `UI`: Add Notifications handler in Profile Store
- :rocket: `UI`: Move all Icon/Iconset Components to CloudTAK
- :rcoket: `API` Add scope: SERVER/USER differentiation in Iconsets and assoc. auth restrictions

