# CHANGELOG

## Emoji Cheatsheet
- :pencil2: doc updates
- :bug: when fixing a bug
- :rocket: when making general improvements
- :white_check_mark: when adding tests
- :arrow_up: when upgrading dependencies
- :tada: when adding new features

## Version History

### Pending Release

### v8.36.0 - 2025-05-23

- :rocket: Make Feature in Feature Menu Draggable
- :rocket: Hovering on Folder should open it after a short timeout
- :rocket: Dropping Feature in folder should append the path and save it
- :rocket: Dragging Feature out of folder should remove path
- :rocket: Improvements to logo customization
- :rocket: Store creator in Connection/Layer/Data objects when possible

### v8.35.1 - 2025-05-20

- :bug: Fix Vue3 related bug on COT Reactivity

### v8.35.0 - 2025-05-20

- :bug: Fix bugs related to MissionToken use in Password Protected Missions

### v8.34.0 - 2025-05-20

- :tada: Add the ability to set personal COT type

### v8.34.0 - 2025-05-20

- :tada: Add the ability to set personal COT type

### v8.33.0 - 2025-05-20

- :rocket: Add the beginnings of integration tests for Connection Managed Video Leases
- :rocket: Perform Mission Name Validation to avoid potential 5xx Error from TAK Server

### v8.32.4 - 2025-05-03

- :bug: Handle edge case of using named network location for media server in Docker Compose not being valid in browser context

### v8.32.3 - 2025-05-03

- :bug: Fix CloudTAK API URL in Docker Compose setup

### v8.32.2 - 2025-05-03

- :bug: Don't notify on your own connection

### v8.32.1 - 2025-05-02

- :bug: Ensure patch Video Lease requests don't reset expiration
- :rocket: Include supported Basemap Actions in TileJSON

### v8.32.0 - 2025-05-02

- :rocket: `API` Support deleting Mission CoTs
- :rocket: Hide edit buttons in CoT view if the user can't edit a COT
- :rocket: Rewrite Notifications pane to be much nicer
- :rocket: Support Mission Creation Notifications

### v8.31.3 - 2025-04-30

- :bug: `API` Publish & Recording should be optional

### v8.31.2 - 2025-04-30

- :bug: `API` Permanent should be an optional field

### v8.31.1 - 2025-04-30

- :bug: `API` Fix URL Encoding

### v8.31.0 - 2025-04-30

- :rocket: `API` Add RTSP Username/Password Template

### v8.30.0 - 2025-04-30

- :rocket: `API` Add Types API for search COT Types
- :rocket: `UI` Add Types Component for searching COT Types
- :bug: Treat Profile API Tokens as User Actions

### v8.29.0 - 2025-04-29

- :bug: Ensure polgon is unhidden if editing is manually stopped
- :tada: Notify on new users popping online
- :bug: Fix Chat Notification message between worker & main thread

### v8.28.0 - 2025-04-29

- :tada: Complete Injector Management UI
- :bug: Update Media Docker image to 3.3.4 to remove some env var requirements

### v8.27.1 - 2025-04-29

- :bug: Small fixes to import system from node-tak

### v8.27.0 - 2025-04-29

- :rocket: Initial support for Repeater Listing & Deleting in Admin UI

### v8.26.0 - 2025-04-28

- :rocket: Sketch out support for UIs for TAK Server operations relevant to CloudTAK

### v8.25.0 - 2025-04-28

- :rocket: Migrate fully to `@tak-ps/node-tak` for TAK Server API Operations

### v8.24.0 - 2025-04-28

- :rocket: Move drawing tools into a submodule of mapStore for significantly cleaner code and future expansion

### v8.23.0 - 2025-04-25

- :bug: Fix a bug where the COT View Component couldn't add new properties due to Vue conflicting with the internal use of a custom Proxy

### v8.22.0 - 2025-04-25

- :rocket: Migrate Icon component to Setup
- :bug: Fix paging update on Data Imports Menu

### v8.21.0 - 2025-04-24

- :tada: Send new `environment:<direction>` Lambda Event on an Environment change in a Layer

### v8.20.0 - 2025-04-24

- :arrow_up: Update to latest node-cot library
- :tada: Support displaying `creator` tags
- :tada: Automatically add `creator` tags on created features

### v8.19.1 - 2025-04-24

- :bug: KML download should download a KML, not GeoJSON

### v8.19.0 - 2025-04-23

- :rocket: Allow exporting Profile Features as GeoJSON or KML

### v8.18.0 - 2025-04-23

- :tada: Allow uploading file from MenuFiles
- :rocket: Migrate MenuTiles to Typescript

### v8.17.0 - 2025-04-23

- :rocket: Show Connection name in Admin Layer List
- :rocket: Show incoming/outgoing/bidirectional status in Admin Layer List
- :rocket: Remove `cron` header by default in Admin Layer List as that is specific to incoming layers
- :bug: Fix filtering bug when JSONata query is set to delete data
- :rocket: Migrate AdminConnection Component to `setup`
- :rocket: Migrate AdminLayer Component to `setup`

### v8.16.0 - 2025-04-22

- :tada: Return TileJSON Actions on ProfileOverlays
- :tada: Introduce Feature API for Basemaps

### v8.15.0 - 2025-04-22

- :tada: Update TileJSON output to v3.0.0
- :rocket: Remove connection wizard as it hasn't gotten any use and significantly increases code base complexity.
- :bug: Fix style overlay update in Admin Overlay editor
- :bug: Fix query style display in Layer Incoming Style Component
- :rocket: Migrate Style Single to `setup`
- :tada: Add the ability to delete features matching a query

### v8.14.0 - 2025-04-21

- :rocket: Expose Public PMTile Endpoints

### v8.13.0 - 2025-04-21

- :rocket: Abstract PMTile operations into class
- :rocket: Update Profile Tile routes to use new shared class
- :rocket: Add TileJSON support for public PMTiles files

### v8.12.0 - 2025-04-20

- :bug: Handle Basemap.collection being null in Basemap UI
- :bug: Allow ZXY Tiles hosted by ESRI MapServer by tightening MapServer matching
- :rocket: Allow parsing `image/<type>` formats in PUT Basemap endpoint

### v8.11.0 - 2025-04-19

- :bug: Migrate RadialMenu to Vue Setup

### v8.10.1 - 2025-04-18

- :bug: Fix path error when editing Lease

### v8.10.0 - 2025-04-18

- :bug: Fix count stats when updating or deleting a DataSync managed via a Connection
- :rocket: `UI` Migrate DataGroups & DataLayers comp to setup
- :rocket: `UI` Migrate WarnChannels component to setup & ts

### v8.9.2 - 2025-04-17

- :arrow_up: Update `@tak-ps/node-cot` to latest version
- :rocket: Increase number of supported rendered features in FeatureIcon component

### v8.9.1 - 2025-04-17

- :arrow_up: Update to `@tak-ps/serverless-http` in PMTiles Task for better express@5 compat.t

### v8.9.0 - 2025-04-17

- :bug: Fix UI Build step due to getOverlayById
- :bug: Fix Stale check on COTs
- :arrow_up: Update Node-CoT

### v8.8.0 - 2025-04-16

- :rocket: Allow opening attachments in a Floating Pane

### v8.7.0 - 2025-04-15

- :rocket: Add username/password support for HLS Streams
- :bug: Fix bug related to authentication payloads from MediaMTX read/write seperated streams
- :rocket: Migrate Refresh buttons to new `TablerRefreshButton` component
- :rocket: Migrate CoordInput component to `setup lang='ts'`
- :bug: Fix Coordinate creation due to proxy error

### v8.6.0 - 2025-04-14

- :rocket: Begin process of merging data and events tasks
- :bug: Fix permanent lease loss if re-saving a permanent lease
- :bug: Show all leases, including expired in admin page
- :rocket: `UI` Add RefreshButton component as a cleaner indication of reloading
- :tada: Show active status in returned User Response

### v8.5.0 - 2025-04-14

- :rocket: Migrate PMTiles Service to routes directory in anticipation of setting up public tiles endpoints

### v8.4.0 - 2025-04-14

- :bug: Ensure Atlas worker isn't constructed more than once by moving shared class into it's own helper file
- :bug: Create new BroadcastChannel for each COT in a remote context
- :rocket: Add `instance` ID to each COT created to greatly assist in debugging

### v8.3.3 - 2025-04-11

- :bug: Allow Null value in CreatorUID in Package List API

### v8.3.2 - 2025-04-10

- :bug: Update DockerCompose with new EnvVars for MediaServer

### v8.3.1 - 2025-04-10

- :bug: Include permanent leases when `expired=false` on VideoLease API

### v8.3.0 - 2025-04-10

- :rocket: Add AllBoolean to expired query param on VideoLease
- :rocket: Implement `lease` AuthResource type on API tokens

### v8.2.0 - 2025-04-10

- :rocket: Add AllBoolean to ephemeral query param on VideoLease

### v8.1.0 - 2025-04-10

- :tada: Handle MediaMTX Auth requests on `/api/video/auth` when `authMethod: internal` is set in MediaMTX

### v8.0.0 - 2025-04-09

- :rocket: Remove Connection Sinks in favor of outgoing layers
- :rocket: Note: Sinks must be migrated manually to etl-arcgis outgoing layer

### v7.33.1 - 2025-04-09

- :bug: Ensure Open Connection status is set in UI on initial load
- :bug: Ensure Atlas Init cannot be called twice

### v7.33.0 - 2025-04-09

- :tada: Allow COTAK API to update password for Connection Cert reissuance
- :tada: `UI` Sketch out AtlasTeam manager
- :bug: Fix TAK Server Connection not getting properly closed when a connection is refreshed

### v7.32.0 - 2025-04-04

- :bug: Fix KML import failure if KMZ included jpg icons

### v7.31.0 - 2025-04-04

- :tada: Add prelim circle mode
- :bug: Fix Video Lease creation in Video Modal if the lease wasn't already "owned" by the CloudTAK server
- :bug: Ensure manual location updates persist to the UI Backend

### v7.30.2 - 2025-04-03

- :rocket: Autocommit version bump

### v7.30.1 - 2025-04-03

- :bug: Ensure ARCGIS_URL is set on new Outgoing Layers

### v7.30.0 - 2025-04-03

- :tada: Show LineString length in CoT sidebar
- :rocket: Show `Circle` for default Overlay Styles

### v7.29.0 - 2025-04-03

- :tada: Show FeatureIcon in CoT Sidebar

### v7.28.0 - 2025-04-02

- :tada: Immediately add COTs to Atlas.Database.cots & introduce `pendingCreate` & `pendingUpdate` queues
- :tada: Add search container for Feature Menu

### v7.27.0 - 2025-04-02

- :bug: Fix scroll on Feature Sidebar

### v7.26.0 - 2025-04-02

- :arrow_up: Update to Express@5

### v7.25.1 - 2025-04-02

- :bug: Allow updating `lambda:UpdateEventSourceMapping`

### v7.25.0 - 2025-04-02

- :rocket: Allow editing directly from the CoT View

### v7.24.0 - 2025-04-01

- :bug: Ensure snapping works without moving the map to refresh snap coordinates in draw mode
- :tada: Introduce Palette support on the backend

### v7.23.0 - 2025-03-28

- :tada: Allow looking up a lease to avoid having to use the Media Server twice
- :tada: Allow setting up recording on a stream
- :rocket: Ensure height/width of Video Player are retained when dragging
- :rocket: Rewrite dragging to avoid file icon while dragging
- :rocket: Video player now fills all available space in div avoiding a mind-the-gap situation

### v7.22.0 - 2025-03-26

- :arrow_up: Update all Core Deps
- :arrow_up: Pin min required NodeJS version to v22 in all Package Files
- :tada: Rewrite of Contacts pane to be more awesome and show what colours are what teams
- :rocket: Allow searching contacts in Contacts Menu
- :white_check_mark: Start to sketch out what testing Connections looks like

### v7.21.0 - 2025-03-21

- :tada: Expose Video Lease API to connection/layers

### v7.20.2 - 2025-03-20

- :bug: Ensure `skipSave` is respected in Atlas Database Worker `add()`
- :bug: Ensure `VideoLease.source_type` & `VideoLease.source_model` are used on creation

### v7.20.1 - 2025-03-20

- :bug: Remove empty SG policy to ensure CloudFormation Drift errors don't alarm

### v7.20.0 - 2025-03-20

- :rocket: `UI` Improvements to Video Lease Manager
- :bug: `UI` Fix `Notififcation` check in Safari

### v7.19.0 - 2025-03-20

- :tada: `UI` Support Path Trees in Feature View Menu

### v7.18.2 - 2025-03-19

- :bug: Video Lease Modal in Admin Page Broken: #547

### v7.18.1 - 2025-03-19

- :bug: Apply SQS Write Permissions to layer-* for outgoing COTs

### v7.18.0 - 2025-03-18

- :rocket: Use Structured Clone on UI BroadcastChannel messages

### v7.17.0 - 2025-03-18

- :bug: Update Lasso mode to expect a Set

### v7.16.0 - 2025-03-18

- :rocket: Move default iconset loading into initial Map Config Payload

### v7.15.0 - 2025-03-18

- :tada: Introduce initial Features menu for more intuitive personal features management
- :rocket: Rewrite COT Tree explorer to use async background calls

### v7.14.0 - 2025-03-17

- :rocket: Show CloudTAK Logo instead of COTAK on configure page

### v7.13.0 - 2025-03-17

- :tada: Rewrite of frontend to use WebWorker

### v7.12.0 - 2025-03-14

- :bug: Improved Environment editing fallback when Capabilities isn't populated
- :rocket: Validate JSON before saving on env editor
- :rocket: Apply defaults to Env in frontend

### v7.11.0 - 2025-03-13

- :rocket: Add debug menu for searching historic COT data

### v7.10.0 - 2025-03-12

- :bug: Fix DataSync limitation checks on LayerIncoming API
- :tada: Add supoort for Duplex/Read/Write channels during Machine User creation when using COTAK API
- :rocket: Rewrite AgenctySelect & Machine User Creation in TS

### v7.9.0 - 2025-03-11

- :bug: Invalidate Layer Ephemeral Cache when making changes to Layer Environment
- :rocket: Add ephemeral Layer Outgoing API endpoints to match Layer Incoming

### v7.8.0 - 2025-03-10

- :rocket: @chriselsen Update outputs related to PMTiles API

### v7.7.0 - 2025-03-10

- :rocket: @chriselsen Fix verbage on login page
- :rocket: Add ability to specify a custom signup URL on login page
- :rocket: Add ability to specify a custom reset password URL on login page
- :rocket: Add ability to specify a custom logo on login page

### v7.6.1 - 2025-03-10

- :rocket: @chriselsen Update License information in CloudTAK Footer

### v7.6.0 - 2025-03-07

- :tada: Introduce file storage at the connection level

### v7.5.0 - 2025-03-07

- :rocket: Introduce a backup editing path to Layer Env if the capabilities object fails to populate

### v7.4.0 - 2025-03-06

- :rocket: Introduce paging on the Video Lease Menu to surface leases that exceed the default limit

### v7.3.0 - 2025-03-05

- :tada: Encode path in ProfileFeature database
- :white_check_mark: Sketch out ProfileFeatures tests
- :white_check_mark: Initial sketching out of NYC coverage

### v7.2.0 - 2025-03-04

- :tada: Implement a check when a file is uploaded via the DataPackage context to see if the upload is already in the DataPackage format and if so just pass it through instead of "double zipping" it
- :rocket: If the upload is not a DataPackage, fall back to creating a new DataPackage in which this upload will be added as a file
- :bug: Fix proper closing of the Zip reader Node-COT Library
- :rocket: Automatically remove the source zip when the DataPackage is parsed.

### v7.1.0 - 2025-02-27

- :bug: Fix issue in ESRI Version Parsing
- :arrow_up: Update DrizzleORM
- :white_check_mark: Add basic ESRI test framework

### v7.0.0 - 2025-02-26

- :rocket: Remove custom AWS CloudWatch metrics as Connection Stability is fairly battletested at this point and costs were significant

### v6.13.0 - 2025-02-26

- :tada: Allow CRUD operations for managing TAK Server Video Connections

### v6.12.1 - 2025-02-25

- :rocket: Include version number in ESRI Errors

### v6.12.0 - 2025-02-25

- :bug: Fix issue where new outgoing layers and sinks couldn't live together

### v6.11.0 - 2025-02-24

- :rocket: Improvements to docker based hosting

### v6.10.0 - 2025-02-12

- :rocket: Add TileJSON generation support for ESRI Feature/Image/Map Services

### v6.9.1 - 2025-02-12

- :bug: Fix ArcGIS Geocoding API Suggest Endpoint

### v6.9.0 - 2025-02-11

- :rocket: Add `hover` feature state to clickable vector layers automatically
- :arrow_up: Update Pinia@3

### v6.8.2 - 2025-02-09

- :bug: Allow creation of Lambda Event Sources

### v6.8.1 - 2025-02-09

- :bug: Allow removal of Lambda Event Sources

### v6.8.0 - 2025-02-09

- :tada: Implement final step in feeding new Outgoing Layers

### v6.7.1 - 2025-02-07

- :bug: Ensure `management` user is retained

### v6.7.0 - 2025-02-07

- :tada: Add support for User auth on MediaMTX Endpoints
- :bug: Fix User filtering on Admin Page

### v6.6.0 - 2025-02-05

- :tada: Add support for ESRI ImageServer in Basemap Editor
- :bug: Fix bug related to setting scope where scope would reset to User
- :tada: Complete support for `collections`

### v6.5.0 - 2025-02-03

- :tada: Add the ability to export a MissionSync archive

### v6.4.0 - 2025-02-03

- :rocket: Call CloudWatch update when incoming/outgoing config are deleted
- :rocket: Add additional permissions for EventSourceMapping
- :rocket: Add ability to delete config from UI

### v6.3.0 - 2025-01-31

- :tada: Add Outgoing APIs

### v6.2.0 - 2025-01-30

- :tada: Sketch out outgoing Config

### v6.1.0 - 2025-01-30

- :rocket: Cacher no longer returns `any` type

### v6.0.1 - 2025-01-30

- :bug: Delete LayerIncoming if it exists when a layer is deleted

### v6.0.0 - 2025-01-30

Note that while the frontend & database have no breaking changes and will be migrated automatically, ALL ETLs LAYERS MUST BE UPDATED!

- :information_source: ETLs must be updated to handle the new flow direction parameter on the `schema()` function
- :rocket: Ephemeral API is now prefixed with `/incoming`
- :rocket: Layer APIs return `incoming: { config }` which is optional
- :rocket: Incoming config is now configured via the `/:layerid/incoming*` API Endpoints
- :rocket: Database migration is performed automatically and no data loss will occur, the user must only ensure that layers are updated to `@tak-ps/etl@8.0.2` or higher
- :bug: Add `alarms=false` default to all layers endpoint
- :rocket Add graceful fallback if AWS Alarms API call fails

### v5.48.2 - 2025-01-28

- :bug: `API` Fix issue where Breadcrumb wouldn't load due to missing callsign

### v5.48.1 - 2025-01-28

- :bug: `API` Parsing errors can be dropped if there are no CoTs to submit to the TAK Server

### v5.48.0 - 2025-01-28

- :bug: `UI` Fix status of Layer Cron if no cron is specified
- :bug: `UI` Turn off loading indicator if layer save fails

### v5.47.0 - 2025-01-24

- :bug: `UI` Fix feat/CoT side bar switcher
- :rocket: Add Secure Username/Pass to VideoLease table
- :bug: Fix webhook role name for creating SubStacks that use webhooks

### v5.46.0 - 2025-01-21

- :bug: `DevOps` Update `python3.8` Lambda as it is being sunset
- :rocket: Add support for full suite of Profile Interest Areas
- :rocket: Add initial Sensor Fusion Support
- :tada: Significant refactor to AdminUser pane
- :bug: Fix search in Data Package list

### v5.45.0 - 2025-01-16

- :tada: `UI` Allow Editing Coordinates
- :bug: `UI` Fix bug in UTM calculations
- :tada: `UI` Show Polygon Area when possible
- :tada` `API` Add Fusion Tables

### v5.44.0 - 2025-01-15

- :rocket: Update Postgres to 17.2

### v5.43.2 - 2025-01-09

- :bug: Fix Connection filtering in CloudTAK Menu

### v5.43.1 - 2025-01-09

- :bug: Fix a bug where lease renewal wouldn't take place

### v5.43.0 - 2025-01-08

- :tada: Allow creating `keywords` on Mission Logs

### v5.42.0 - 2025-01-05

- :bug: Fix coordinate precision when editing features

### v5.41.0 - 2025-01-05

- :tada: Allow editing your own CoT's remarks
- :rocket: Treat one's own location as a typical CoT

### v5.40.0 - 2025-01-03

- :bug: If a custom TAK Group name is not set the group:: prefix is shown to the user when it shouldn't be and is correctly rejected if selected by the PATCH Profile API

### v5.39.0 - 2025-01-03

- :bug: Allow non-email usernames as provided by a TAK Server

### v5.38.0 - 2025-01-02

- :rocket: Rewrite Connection Pane in TS
- :rocket: Use `menu` & `menuitem` for accessibility
- :rocket: Rewrite MissionContents in TS and remove a ton of unused cruft and fix a bunch of bugs around showing imports related to that mission
- :tada: Update to latest node-cot which supports `strict:false` mode for automatically converting an invalid DataPackage into a valid one
- :tada: Use the new `strict: false` mode for automatically importing default Iconsets on a newly provisioned server
- :rocket: Move all the initial loading code to the `Bulldozer` class which runs on server startup

### v5.37.0 - 2024-12-30

- :tada: Add snapping feature when drawing Lines & Polys (thanks to adding the custom function hook @JamesLMilner with [TerraDraw](https://github.com/JamesLMilner/terra-draw/)
- :bug: Fix display of layers on a given connection

### v5.36.0 - 2024-12-29

- :tada: `UI` Implement User Select dropdown
- :rocket: `UI/API`Allow assigning System/Private scope to basemaps via Admin Basemaps console
- :rocket: `UI` Allow assigning Username to Private Basemaps

### v5.35.0 - 2024-12-29

- :rocket: `UI` Migrate AdminServer to TS
- :rocket: `UI` Better responsive behavior

### v5.34.0 - 2024-12-27

- :rocket: Fix style defaults in UI
- :bug: Fix adding layers in UI
- :tada: Add `title` field for Overlays

### v5.33.0 - 2024-12-26

- Move COTAK API Integration into optional config instead of on the Server Page

### v5.32.0 - 2024-12-25

- Converting a ton of the UI To typescript
- Renaming `Basemap.group` => `Basemap.collection` and adding new `BasemapCollection` Table
- Merge ETL Task & Registered task Admin UI into single Admin Page
- Separate admin tabs out by type5

### v5.31.0 - 2024-12-22

- :rocket: Set groundwork for Basemap groups
- :bug: Improved editing behavior

### v5.30.0 - 2024-12-20

- :tada: Globe projection is now surfaced as default map view
- :rocket: Allow switching to mercator projection in display settings

### v5.29.0 - 2024-12-18

- :rocket: Page through AWS Alarms to support layers > AWS default page size
- :bug: Allow multiple alarms for a given layer to influcence alarm state

### v5.28.0 - 2024-12-18

- :tada: Surface shared VideoLeases in API & UI

### v5.27.0 - 2024-12-18

- :rocket: Update Callsign Settings component to TS
- :rocket: Move interval timers and current location to profile store
- :rocket: Add `tak_loc_freq` field to UI and API

### v5.26.0 - 2024-12-17

- :bug: `API` Ensure `channel` is retained in VideoLease POST if set
- :bug: `UI` Show lease expiration/permanence in VideoLease List & Modal

### v5.25.0 - 2024-12-17

- :tada: `API` Rewrite PMTiles in `express/batch-schema` to squash bugs, massively improve readability, and open the door to the ability to run it locally

### v5.24.0 - 2024-12-13

- :tada: `DevOps` Allow DockerCompose mode to use minio configured store

### v5.23.0 - 2024-12-13

- :rocket: `UI/API` Update ManagementURL in COTAK API (if configured) with Connection ID

### v5.22.0 - 2024-12-11

- :tada: `UI/API` Allow System Administrators to manage Video Leases
- :rocket: `UI` Migrate Admin Video pages to TS

### v5.21.0 - 2024-12-11

- :bug: `UI` Allow editing Video Lease fields when creating a new lease
- :bug: `UI` Fix duplicate locked entries being added to Locked Array
- :tata: `UI` Add Breadcrumb Dropdown to select duration of breadcrumb to load

### v5.20.0 - 2024-12-11

- :rocket: `UI` Allow locking the map view to a CoT via the Radial Menu

### v5.19.1 - 2024-12-10

- :rocket: `UI` Ensure switching to Admin Component doesn't throw an error

### v5.19.0 - 2024-12-10

- :rocket: `UI` Update Main Map to TS

### v5.18.4 - 2024-12-09

- :bug: CoT property updates were being rendered but not updated in the underlying store

### v5.18.3 - 2024-12-09

- :bug: Return a 404 Response if CoT history endpoint returns nothing for a given UID

### v5.18.2 - 2024-12-09

- :bug: Fix issue with Row Editor Modal in Layer Environment
- :rocket: Make Loading text white on Connection/Layer/Data

### v5.18.1 - 2024-12-09

- :bug: Fix bug where Connection wasn't cleaned up after the WebSocket was closed
- :bug: Fix bug where path would result in `<dest/>` tag wasn't added

### v5.18.0 - 2024-12-08

- :tada: Allow setting CloudTAK Config values via Config

### v5.17.2 - 2024-12-08

- :bug: Fix `color` not being required in mission layer

### v5.17.1 - 2024-12-06

- :bug: Fix disablement of cron job from web UI

### v5.17.0 - 2024-12-06

- :tada: `UI` Add ability to query BreadCrumb for last hour for a given active user
- :tada: `UI` Only show Edit fns on Radial for CoTs from Mission with edit role
- :tada: `UI/API` Update Layer to support Webhooks & Cron style of deploys
- :rocket: `UI` Migrate LayerConfig to TS
- :rocket: `API` Add `VideoLease.channel` column for future use for channel management of leases
- :rocket: `UI` Migrate Channel Menu to TS
- :rocket: `UI` Add ability to turn all channels on/off from single button
- :rocket: `API` Add `webhooks` field to Layer Template
- :bug: `UI` Remove UI for Layer Query as the backend was removed
- :bug: `API` Fix broken tests
- :tada: `API` Add CoT history endpoints to profile & layer API base paths
- :arrow_up: Update Drizzle to latest versions

### v5.16.0 - 2024-12-02

- :tada: `UI` Add filter support for Share Component

### v5.15.0 - 2024-12-02

- :tada: Update Overlay to use MissionLayerTree for displaying CoTs
- :rocket: Update CoT Class to expose `flyTo` fn
- :rocket: Update MissionLayer to TS

### v5.14.0 - 2024-12-01

- :rocket: Editing Fields for CoTView

### v5.13.0 - 2024-12-01

- :bug: Accidently versioned twice

### v5.12.0 - 2024-12-01

- :tada: `UI` Show Icon if available in `Feature.vue`

### v5.11.0 - 2024-11-27

- :rocket: `UI` Fully migrate Data Package Menu to TypeScript
- :bug: `UI` Fix 404 when Data Package Hash differed from Data Package UID
- :bug: `UI` Fix Package type definition to use Package instead of similiar (and current) Content

### v5.10.0 - 2024-11-27

- :rocket: `UI` Consistent CoT saving for archived CoTs

### v5.9.0 - 2024-11-26

- :rocket: `UI` Allow CoT Marker to update itself via Proxy implementation
- :rocket: `UI` Introduce new click to edit functionality & use for callsign to start

### v5.8.0 - 2024-11-25

- :rocket: `UI` Migrate `Package.vue` to TS
- :rocket: `UI` Migrate `Packages.vue` to TS
- :rocket: `UI` Migrate `Imports.vue` to TS
- :rocket: `UI` Migrate `Import.vue` to TS
- :rocket: `UI` Show Data Sync icon next to Syncs in Overlay Pane
- :rocket: `UI` Allow zooming to bounds of Data Sync in Overlay Panel
- :rocket: `UI` Migrate `Overlays.vue` to TS
- :rocket: `UI` Migrate `CoTView.vue` to TS
- :rocket: `UI` Share origin of CoT in COT type
- :rocket: `UI` Show Data Sync origin in CoTView

### v5.7.0 - 2024-11-23

- :rocket: `UI` Migrate `Feature.vue` to TS
- :bug: `UI` Remove need for `mission` prop of `Feature.vue` in favour of unified `cotStore.get(uid)`
- :rocket: `UI` Add Video Icon support in `Feature.vue`
- :rocket `API` Add Vide Connection Manager V2 APIs
- :rocket `UI` List Video Connection Manager Connections in Video List
- :rocket: `UI` Use `Feature.vue` in Video List Menu
- :rocket:` `UI` Allow opening Video Connection Manager Videos in Video Player

### v5.6.0 - 2024-11-20

- :rocket: `API` Move Font Serving to API for faster website builds
- :bug: `API` Add SRT URL building support
- :rocket` `API` Don't sent expired CoTs to connection if stale < now

### v5.5.0 - 2024-11-19

- :bug: `API` Fix issue with on-server scheduling resulting in massive rate limiting
- :rocket: `DevOps` Start to sketch out S3 Bucket for UI hosting

### v5.4.0 - 2024-11-18

- :tada: `UI/API` Add support for permanent leases

### v5.3.0 - 2024-11-18

- :rocket: `UI` Show play button in Radial
- :tada: `UI` Show video in popout player
- :rocket: `UI` Allow resizing of Video
- :rocket: `UI` Allow dragging of video

### v5.2.0 - 2024-11-15

- :bug: Fix Media CSP in Chrome which uses `blob:` for display
- :rocket: Add support for showing Text styles in Overlay Vector Pane
- :rocket: Add support for serving tiles directly from an ESRI Feature Server

### v5.1.0 - 2024-11-14

- :rocket: Show soft error if output schema could not be determined in LayerEnvironment component

### v5.0.2 - 2024-11-13

- :bug: Don't delete container layer if empty

### v5.0.1 - 2024-11-13

- :rocket: More granular check for Notification variable

### v5.0.0 - 2024-11-13

- :rocket: `API` Remove DynamoDB backend for feature store as it is no longer used and suffered from a massive memory leak & assoc. layer features APIs
- :rocket: Migrate MissionLayerTree & MissionUsers to TS
- :rocket: Add support for recursive/nested folders in Mission Sync layers UI
- :rocket: Add support for automatically creating/deleting folders via `path` attributes from ETLs when using Data Sync

### v4.37.0 - 2024-11-12

- :bug: Fix issue where if the WebTAK API wasn't hosted on `443` then CloudTAK Could not be configured

### v4.36.0 - 2024-11-08

- :rocket: `DevOps` Restrict all ECS Task Traffic as coming from the ALB

### v4.35.0 - 2024-11-08

- :bug: `DevOps` Tighten up Media Task SG ingress to only needed ports. Note: You will have to deploy this by manually setting the ingress ports to [] and then setting them to the ports in this version

### v4.34.0 - 2024-11-07

- :bug: Fix subscription bug where an unsubscribe wouldn't clean up the cotstore.subscription
- :tada: Allow subscribed missions to be exported as Data Packages
- :rocket: Migrate Mission menu to TS
- :rocket: Migrate Menu to TS
- :rocket: Increase non-admin lease time to 24 hours

### v4.33.0 - 2024-11-06

- :tada: Allow creating a Public DataPackage from a selection of CoTs
- :bug: Fix CSP Policy Issue when a ROOT_URL needs to be replaced (formerly done in ./start, now done in nginx.conf.js)
- :bug: Remove all Public Access to RDS Instances

### v4.32.1 - 2024-11-04

- :arrow_up: Update to latest node-cot

### v4.32.0 - 2024-11-04

- :rocket: Migrate Missions List to TS
- :rocket: Automatically subscribe to a mission if you create it
- :data: Add ability to share a list of CoTs with a mission if subscribed
- :bug: Fix issue where Mission Data wouldn't populate after subscribe
- :bug: Creating Mission with password results in error due to call to /role with undefined
- :bug: Attempting to subscribe to a mission with a password results in an error
- :bug: Battery Status not shown on CoT View

### v4.31.2 - 2024-11-03

- :bug: `UI` Fix Initial Basemap Load

### v4.31.1 - 2024-11-02

- :bug: `API/UI` Fix Mission Sync Subscription

### v4.31.0 - 2024-11-01

- :rocket: `API/UI` Allow Sharing Basemaps

### v4.30.0 - 2024-10-31

- :rocket: `API` Ensure Media Server is resynced on VideoLease Patch call

### v4.29.0 - 2024-10-31

- :bug: `UI` More generic location error handling in the CloudTAK UI
- :bug: `UI` Ensure `Notification` api object is present

### v4.28.0 - 2024-10-29

- :rocket: `API` Strongly type Mission Subscription Roles API
- :rocket: `UI` Cleaner Share Menu
- :rocket: `UI` Add ability to delete multiple selected markers
- :tada: `DevOps` Add ability to optionally exec into container
- :bug: `UI` Fix error when clicking on find my location button if no location can be found
- :rocket: `UI` Migrate `Select` modal to use `Feature` component for CoT listing
- :rocket: `UI` Show Colour and Geometry type in `Feature` component
- :tada: Add 0 Invocation Alarms to ETL Layers

### v4.27.0 - 2024-10-26

- :rocket: `DevOps` Generate nginx config from NodeJS script to disable CSP in docker compose
- :rocket: `API` Update Core Deps
- :tada: `API` Load CloudTAK-Data repo in Docker image
- :tada: `API` Load Basemaps when no basemaps have been configured in CloudTAK from CloudTAK-Data repo to avoid blank map in first login of new server

### v4.26.0 - 2024-10-25

- :bug: `API` Add support for `%` decoding in PMTiles URL Validity Check
- :rocket: `UI` Use `TablerIconButton` for buttons in Overlay manager to improve accessibility
- :rocket: `UI` Fix Delete Icon size in Overlay Manager
- :rocket: `UI` Add CloudTAK Gradient to backend

### v4.25.0 - 2024-10-25

- :rocket: `DevOps` After analyzing our traffic for the past 60 days we didn't have a PMTiles invocation above 100mb. Reduced Lambda Memory to 256mb

### v4.23.0 - 2024-10-25

- :rocket: `PMTiles` Standardize Error Format

### v4.22.0 - 2024-10-24

- :rocket: `DevOps` Add KMS Key Alias

### v4.21.0 - 2024-10-23

- :rocket: `UI` Snazz up the login page
- :rocket: `UI` Rewrite AdminUser.vue in TS
- :rocket: `UI` Add support for JS Notification API

### v4.21.0 - 2024-10-17

- :bug: Fix Iconset Filter in UI
- :tada: Add `data_alt` field to show a different icon in CloudTAK than the Iconset Default
- :bug: Automatically resize to a width of 32px on all spritesheets
- :bug: Fix a bug where CoT messages that didn 't need to be updated in a Data Sync were injected into the channel

### v4.20.0 - 2024-10-17

- :tada: `UI` Add ability to renew lease & show if lease is expired
- :rocket: `UI` Show expired leases in Lease List
- :rocket: `API` Add ability to PATCH duration
- :rocket: Migrate VideoLeaseModal to TS

### v4.19.2 - 2024-10-17

- :arrow-up: Update to `@types/express@5`

### v4.19.1 - 2024-10-16

- :rocket: Match actual `status` to status returned in body

### v4.19.0 - 2024-10-16

- :rocket: Show Mission Sync password errors inline
- :bug: Fix `ownerRole` response types which had resulted in error on Mission Create
- :tada: Allow for tolerant GeoJSON parsing and return failed features & reason in response
- :rocket: Start to use `TablerIconButton` for standard accessibility features
- :rocket: Use `TablerDelete` when deleting Mission Sync Logs

### v4.18.1 - 2024-10-15

- :rocket: Delete leases when possible

### v4.18.0 - 2024-10-15

- :tada: Add a modal if the Profile hasn't been configured

### v4.17.0 - 2024-10-15

- :tada: Add the ability to set custom group names in the TAK_Group dropdown

### v4.16.0 - 2024-10-15

- :rocket: Add `group::` config
- :rocket: `UI` Show None state if no logs are present
- :tada: `UI` Sketch out Mission Container Class
- :rocket: Log updates from another device in subscribed mission will now automatically show up
- :rocket: Migrate MissionLog pane to TS
- :rocket: `UI` Show keywords array
- :rocket: `API` Strongly Type MissionLog keywords

### v4.15.1 - 2024-10-14

- :bug: `UI/API` Disallow name changes to Data Syncs

### v4.15.0 - 2024-10-14

- :bug: `UI` Fix bug where a refresh wouldn't add Data Sync layer back on map state
- :rocket: `UI` Strongly Type the MissionLog Menu
- :rocket: `UI` Avoid a full mission refresh when a log is added or deleted

### v4.14.0 - 2024-10-14

- :rocket: `API` Add List Logs endpoint

### v4.13.0 - 2024-10-10

- :tada: `UI/API` Add support for storing TAK Derived LineStrings & Polygons to an ESRI Sink
- :rocket: `UI` Add a bunch more `role=button` & `tabindex=0` for accessibility
- :rocket: Migrate `DevOps` from old `AWS_DEFAULT_REGION` => `AWS_REGION` end var

### v4.12.0 - 2024-10-10

- :rocket: `UI` Show Log Creation by default if MISSION_WRITE permission is present

### v4.11.0 - 2024-10-10

- :rocket: `UI` Add Chat button from CoTView context to create a new chat
- :rocket: `UI` Fix header of individual chat pane by using MenuTemplate component

### v4.10.0 - 2024-10-10

- :rocket: `UI` Enable Mission_Diff mode by default
- :bug: `API` Ensure connection subscription is created on initial DataSync creation

### v4.9.0 - 2024-10-09

- :rocket: `DevOps` Add top level build script for pushing ECR Images to given AWS account
- :rocket: `DevOps` Switch GH Actions to use new build pipeline

### v4.8.0 - 2024-10-09

- :rocket: `UI` Hide CoTView properties with no values
- :rocket: `UI` Allow adding properties such as Video/Sensor/Attachment via a 3 dot button
- :tada: `UI` Support editing Sensor values in CoTView (Still not viewable on map)

### v4.7.0 - 2024-10-07

- :rocket: `UI/API` Add initial configuration mode
- :rocket: Rename `task-{{sha}}` to `data-{{sha}}` to match folder names

### v4.6.0 - 2024-10-03

- :rocket: `UI` Add Sector Drawing Mode

### v4.5.1 - 2024-10-02

- :rocket: `UI` Use colour to show terrain enablement state
- :rocket: `UI` Allow toggling 3D terrain on and off

### v4.5.0 - 2024-10-02

- :tada: `UI` Show a 3D Terrain button if 3D Terrain is enabled

### v4.4.2 - 2024-10-02

- :rocket: `API` Start to make improvements to caching behavior on initial load

### v4.4.1 - 2024-10-01

- :bug: `API` Set `useCache=true` when making Group List calls

### v4.4.0 - 2024-10-01

- :rocket: `UI` Use geolocation.watchPosition API instead of individual getLocation calls

### v4.3.0 - 2024-10-01

- :tada: Add the ability to see what channels a user has active (limited to channels you have access to)

### v4.2.0 - 2024-09-30

- :white_check_mark: Add initial Basemap Tests
- :white_check_mark: Add initial Server Config Tests
- :rocket: Add initial Certificate expiry API for admin cert

### v4.1.1 - 2024-09-26

- :bug: `API` Fix const assignment

### v4.1.0 - 2024-09-26

- :rocket: `API` Support `{$q}` variable for Basemaps (Quadkeys)

### v4.0.0 - 2024-09-25

- :rocket: `UI/API` Consolidate Server Overlays & Basemaps into a single Table with an `overlay: true` differentiation

### v3.38.2 - 2024-09-25

- :rocket: `UI` Support dual icon formats in IconSelect component

### v3.38.1 - 2024-09-25

- :rocket: `UI` Dedupe features at top of click event to avoid MultipleFeats opening with a single Feature

### v3.38.0 - 2024-09-25

- :rocket: `UI` Implement Lasso Select
- :rocket: `UI` Fix duplicate MultipleFeats component entries
- :bug: `API` Relax phone number requirements for System Admins

### v3.37.0 - 2024-09-25

- :rocket: `UI` Add course indicator for Skittle dots
- :rocket: `API` Add Video API Support

### v3.36.0 - 2024-09-24

- :rocket: Mirror sent headers on Overlay and Basemap

### v3.35.1 - 2024-09-24

- :bug: Fix clickable layer regression now that layer styles are saved to the database

### v3.35.0 - 2024-09-24

- :tada: Add a `{{fallback key1 key2 etc}}` helper for Handlebar templates

### v3.34.0 - 2024-09-24

- :rocket: Add cache of default Font Glyphs
- :rocket: Add support for increased number of MapLibre layer types
- :rocket: Add shared MapLibre Style Layers component
- :rocket: Allow raw editing of MapLibre styles

### v3.33.0 - 2024-09-20

- :bug: `UI` Fix BaseMap Menu `Create` Button
- :bug: `UI` Fix listing server overlays in CloudTAK Menu
- :rocket: `API/UI` Add support for setting min/max zoom
- :rocket:  `API` Migrate `styles` columns to Unknown array type
- :bug: `API` Fix Maplibre GL Style Validation which to date hasn't been used
- :rocket: Add Server Overlay `/tiles` and ZXY endpoints
- :rocket: Save Styles to database for given layers
- :rocket: `UI` Dynamically regenerate source and layer IDs from provided styles
- :tada: Write TileJSON proxy which speeds up tile passthrough by roughly 8x


### v3.32.0 - 2024-09-18

- :bug: Fix CSP headers to allow Video Server access
- :rocket: Add `ephemeral` flag to Video Lease for temporarily proxy leases
- :rocket: Switch Basemap Format to dropdown element instead of free-text
- :bug: Fix lease generation UI bug where an ID wasn't properly populated upon creation
- :rocket: Update node-cot to support parsing CoTs with present (but empty) video tags
- :rocket: Gracefully catch errors and display inline for Video Player

### v3.31.0 - 2024-09-17

- :rocket: Basemap parsing and typing improvements

### v3.30.0 - 2024-09-16

- :rocket: Allow editing settings of Video Service from CloudTAK
- :rocket: Allow setting up temporary leases from CloudTAK
- :rocket: View information about a given path
- :rocket: Show Ports associated with given Video Protocol
- :rocket: Add built-in video player to CoT View

### v3.29.0 - 2024-09-11

- :bug: `UI` Fix search box offset - https://github.com/dfpc-coe/CloudTAK/issues/330
- :rocket: `UI` Disabled Text Selection on Multiple Feature Component - https://github.com/dfpc-coe/CloudTAK/issues/331
- :rocket: `UI` Multiple feature component now uses `Feature` component for rendering list
- :rocket: `UI` Show icon for Import Type - https://github.com/dfpc-coe/CloudTAK/issues/329
- :rocket: `UI` Show attachment images that are png or jpg inline - https://github.com/dfpc-coe/CloudTAK/issues/259

### v3.28.0 - 2024-09-11

- :tada: `DevOps` CF Parameter `HostedURL` must omit protocol - ie: map.cotak.gov not https://map.cotak.gov
- :tada: `DevOps` CF Parameter SSL Certificate must support two wildcards - ie `*.map.cotak.gov` and `*.cotak.gov` to ensure PMTiles Task traffic is over https
- :rocket: `DevOps` Disable HTTP PMTiles API
- :bug: `UI` Fix Settings Icon in Menu

### v3.27.0 - 2024-09-10

- :rocket: `DevOps` Add additional security headers

### v3.26.1 - 2024-09-10

- :rocket: `DevOps` Remove `forever` in favour of new ECS Restart Policy

### v3.25.1 - 2024-09-09

- :bug: `UI` Fix logo size in login/loading
- :rocket: `API` Add additional security headers

### v3.25.0 - 2024-09-06

- :rocket: `API` Initial support for routes

### v3.24.0 - 2024-09-06

- :rocket: `UI` Add Phone Component

### v3.23.0 - 2024-09-05

- :rocket: Automatically add archived tag to ProfileFeature objects as it is implied when they are saved
- :tada: Add relative time to CoT View panel and basic switcher from relative <=> absolute
- :rocket: Convert timediff to TS and add support for future relativity, doesn't that sound fancier than it is.

### v3.22.0 - 2024-09-05

- :arrow_up: Update to node-cot@12 to fix type coercion - https://github.com/dfpc-coe/node-CoT/issues/36
- :rocket: Tighten up accuracy requirements for live location updates

### v3.21.1 - 2024-09-05

- :bug: `UI` More lenient permission check for location denied

### v3.21.0 - 2024-09-04

- :bug: `UI` Fix Coordinate Input error due to lack of ID generation
- :rocket: Add type selection in Coordinate Input Modal

### v3.20.3 - 2024-09-04

- :bug: `UI` Fix Point Icon Selection

### v3.20.2 - 2024-09-04

- :bug: `UI` Fix warning about use of THead

### v3.20.1 - 2024-09-04

- :bug: `UI` Use computed property on Task List

### v3.20.0 - 2024-09-04

- :tada: `UI` Add the ability to filter by Layer Task type in Admin UI

### v3.19.0 - 2024-09-04

- :tada: Add ephemeral column to Layer table

### v3.18.0 - 2024-09-03

- Remove use of `MartiAPI` env var in favour of database value
- Move login call to TAK API wrapper
- Add `minio` Docker package for alternate S3 API
- Remove `--local` option
- Allow accessing Password Protected Missions - Closes: https://github.com/dfpc-coe/CloudTAK/issues/289

### v3.17.0 - 2024-08-30

- :tada: Enable live location updates for mobile users

### v3.16.2 - 2024-08-30

- :arrow_up: Update task/pmtiles dependencies
- :bug: `API` Fix bug in CoT submission

### v3.16.1 - 2024-08-30

- :arrow_up: Update task/hook dependencies

### v3.16.0 - 2024-08-30

- :rocket: `UI` Remove DataUser menu in favour of unified Files Menu
- :rocket: `UI` Truncate File Name in File Menu - Closes #302
- :rocket: `UI` Add a file to overlay from File Menu - Closes: #291
- :arrow_up: Update to latest drizzle versions
- :tada: Enable TS `strict: true` mode

### v3.15.0 - 2024-08-28

- :tada: `UI` Use new TerraDraw Angled Rectangle Mode thanks to @JamesLMilner

### v3.14.1 - 2024-08-28

- :bug: `UI` Fix trim call on non-existant callsign field

### v3.14.0 - 2024-08-28

- :tada: `API` Add preliminary support for importing KMLs

### v3.13.1 - 2024-08-28

- :bug: `UI` Map Load as manual promise to avoid unstyled icons/mission updates

### v3.13.0 - 2024-08-27

- :rocket: `UI` Store Mission Metadata for actively subscribed missions
- :tada: `UI` Create first Vue/Typescript file in the frontend

### v3.12.0 - 2024-08-26

- :rocket: `UI` Use CoTView for Mission API COTs
- :bug: `API` Fix bug in MissionLayer GUID lookup

### v3.11.2 - 2024-08-26

- :rocket: `API` Migrate remaining endpoints where possible to allow GUID lookup for missions

### v3.11.1 - 2024-08-26

- :bug: `API` Mission#latestFeats API would return empty array if only a single Feature were in a MissionSync

### v3.11.0 - 2024-08-26

- :tada: `UI/API` Add ability to view stream locations in Lease Panel

### v3.10.1 - 2024-08-26

- :bug: `UI` Fix thrown error on expired/invalid token when already at the login page

### v3.10.0 - 2024-08-25

- :tada: `API/UI` Fully merge file imports into CloudTAK UI
- :rocket: `UI` Fully remove Profile section of UI

### v3.9.1 - 2024-08-23

- :bug: `API` Fix login bug on invalid token

### v3.9.0 - 2024-08-23

- :rocket: `UI` Add Copy functionality to CoTView

### v3.8.0 - 2024-08-22

- :rocket: `API` Add MediaMTX Path Creation
- :rocket: `API` Add MediaMTX Path Deletion
- :Rocket: `API` Wire up delete/create from Video Lease API via VideoControl

### v3.7.0 - 2024-08-22

- :rocket: Expose Video Service Config Options
- :rocket: Move Video Lease UI to CloudTAK Menu
- :rocket: Allow deleting Video Lease
- :rocket: Add Video Service Management UI Section in Admin Dashboard
- :rocket: Add Authentication to Video Server

### v3.6.0 - 2024-08-21

- :rocket: `API/UI` Enforce at least 1 channel on Machine User creation

### v3.5.0 - 2024-08-21

- :bug: `API` Roll back to detachContents call for MissionSync until TAK Server supports this in 5.3

### v3.4.0 - 2024-08-12

- :bug: `UI` Fix bug in ArcGIS UI When portal wasn't set
- :rocket: Switch to direct GUID calls when possible in Mission.js API
- :tada: Add editing support for Server Overlays

### v3.3.0 - 2024-08-12

- :arrow_up: node-tak & node-cot to latest versions
- :bug: `UI` Fix date bug in asset list

### v3.2.0 - 2024-08-12

- :rocket: Increase FiFo Sink Throughput

### v3.1.0 - 2024-08-12

- :tada: Use CoT submission for DataSync delete

### v3.0.1 - 2024-08-12

- :bug: For an unknown reason CloudFormation needs the list permission now, reasonable but not sure what changed

### v3.0.0 - 2024-08-12

- :rocket: **Breaking** Create Mission Syncs with POST request, simplifying the internal code
- :rocket: Padding above filter boxes in menu
- :bug: Fix scrolling in CoTView raw mode
- :rocket: Fix margins/padding in Mission Sync logs
- :rocket: Use unified GroupSelect, adding search/filtering
- :rocket: Show subscribed missions at top of Missions Menu

### v2.99.0 - 2024-08-10

- :rocket: `UI` PWA now supports live location while on the move

### v2.98.0 - 2024-08-09

- :rocket: `UI` Use fitBounds where appropriate

### v2.97.0 - 2024-08-09

- :rocket: `UI` Show COT Type as a human readable value
- :rocket: `UI` Show X button instead of back on menus that will close to the map

### v2.96.0 - 2024-08-09

- :rocket: `UI` Add a Mission Tree to Overlay panel

### v2.95.1 - 2024-08-08

- :rocket: `UI` Get rid of `moment` entirely

### v2.95.0 - 2024-08-08

- :bug: `UI` Significant perf improvement in rendering large number of features by dropping moment in favour of native dates

### v2.94.0 - 2024-08-08

- :bug: `UI` Route `feat` vs `cot` messages property from Multiple Select Comp.
- :rocket: add COT container for incoming COTs to serve as a class for functions on a COT
- :rocket: update the container on COT messages with same UID instead of replacing feature
- :tada: Add `as_rendered` function to only encode the core properties required for map rendering

### v2.93.0 - 2024-08-07

- :tada: `API` Add flow log tags to CloudTAK Layer data
- :tada: `UI` Use Lng/Lat in Coordinate boxes
- :rocket: `UI` Add PWA logo and safari settings
- :rocket: Start adding alt text and roles to buttons

### v2.92.1 - 2024-08-07

- :bug: `UI` Fix scrolling on backend

### v2.92.0 - 2024-08-06

- :bug: `UI` Re-introduce CoT reset on channel change which was dropped when the menu router was introduced
- :rocket: `UI` Remove a CoT from the cot store on delete intead of retaining unrendered features
- :tada: Automatically attach attachments in DataPackage when a CoT is shared

### v2.91.0 - 2024-08-06

- :tada: `API/UI` Add ability to attach Attachments to a CoT

### v2.90.0 - 2024-08-06

- :tada: `UI` Add initial PWA basics

### v2.89.0 - 2024-08-05

- :rocket: `UI` Add attachments section
- :tada: `API` Process attachments that come in via DataPackages

### v2.88.0 - 2024-08-04

- :rocket: `UI` Add `Elevation` component where relevant in CoTView

### v2.87.2 - 2024-08-01

- :bug: `UI` Fix Unmount behavior on CloudTAK Map Page

### v2.87.1 - 2024-07-31

- :bug: `API` Fix Global ID validation bug

### v2.87.0 - 2024-07-31

- :rocket: `API/UI` Allow ID overrides in Style Editor
- :data: `UI` Add enabled toggles for Global Overrides
- :bug: `UI` Fix opacity slider which wouldn't save

### v2.86.0 - 2024-07-31

- :bug: `API/UI` Allow specifying Alarm Options

### v2.85.3 - 2024-07-31

- :bug: `UI` Make Delete ProfileFeature call after removing from map

### v2.85.2 - 2024-07-31

- :bug: `API` New deployments had `opacity` as an integer => change to float

### v2.85.1 - 2024-07-31

- :bug: `API` Return empty features array on empty DataSync

### v2.85.0 - 2024-07-31

- :rocket: `UI` Move API Tokens under CloudTAK Settings

### v2.84.0 - 2024-07-30

- :rocket: `API` Switch to static XML parsing for Mission Sync Contents for :racehorse:

### v2.83.1 - 2024-07-30

- :rocket: `API` Add Access Logs

### v2.83.0 - 2024-07-30

- :rocket: `API` Add Alarm columns to Layer/LayerTemplate for future use in AWS CF gen for ETLs
- :rocket: `API` Send ELB logs to elb-logs bucket

### v2.82.0 - 2024-07-29

- :rocket: `API` Remove use of `check-geojson` in favour of `InputFeature` schema definition from node-cot
- :rocket: `API` Introduction of a cache system for reusing compiled handlebar templates within a single feature collection payload

### v2.81.0 - 2024-07-29

- :rocket: `UI` Point Type Selection

### v2.80.3 - 2024-07-29

- :bug: `API` More persistant retry on connection fail
- :rocket: `API` Retry Mission Subscription on ECONNREFUSED

### v2.80.2 - 2024-07-29

- :bug: `UI` Ensure basemap creation on initial account creation doesn't error

### v2.80.1 - 2024-07-26

- :bug: `API` Ensure emails are always lowercased

### v2.80.0 - 2024-07-26

- :rocket: `UI` Allow deleting CoTs or Groups of CoTs from TreeCoT Overlay view

### v2.79.0 - 2024-07-25

- :rocket: `UI` Parallel init & hide map interactions until map is loaded

### v2.78.0 - 2024-07-25

- :rocket: `UI` Parallel init & hide map interactions until map is loaded

### v2.77.2 - 2024-07-25

- :rocket: `UI` Fix ID Strategy bug with TerraDraw

### v2.77.1 - 2024-07-24

- :rocket: `UI` Add ability to delete Import

### v2.77.0 - 2024-07-24

- :rocket: `UI` Slightly more comprehensive version of CoT Trees in overlay viewer
- :bug: `UI` Fix recursive bug in Coordinate Entry
- :bug: `API` Make CreatorUID optional in Data Package API as it was 400ing for certain users

### v2.76.0 - 2024-07-23

- :bug: `UI` Fix bug in initial load of MissionData
- :rocket: `API` Wire up import manager => Asset Transform (this still needs UX work but it does work)
- :tada: Add initial Import Delete API

### v2.75.1 - 2024-07-22

- :bug: `API` Limit imports listing

### v2.75.0 - 2024-07-22

- :rocket: `UI` Fix drag-and-drop upload in CloudTAK Map view
- :rocket: `UI` Add manual import button in Imports Menu
- :rocket: `UI` Show Import not found inline in import menu

### v2.74.0 - 2024-07-22

- :rocket: `UI` Complete rewrite of Overlay management
- :rocket: `UI` Support saving Basemaps to ProfileOverlay

### v2.73.1 - 2024-07-19

- :rocket: `UI` round coordinates in Point Input
- :rocket: `UI` Only show point input, close underlying menu

### v2.73.0 - 2024-07-19

- :rocket: `UI` Implment user suggestions for "clickable" contacts vs a seperate zoomTo button
- :rocket: `UI` Divide contacts into active and recently offline

### v2.72.0 - 2024-07-18

- :rocket: `UI` Map incoming CoTs from Missions to their correct layer

### v2.71.0 - 2024-07-17

- :bug: `UI` Release the Integration Wizard - a new workflow for quickly creating Layers from Templates

### v2.70.3 - 2024-07-16

- :bug: `UI` Fix login Component redirecting to login component - resulting in stalled loading pane

### v2.70.2 - 2024-07-16

- :rocket: `UI` Update vue-tabler

### v2.70.1 - 2024-07-16

- :rocket: `UI` Add `required` & `description` to Layer Env editor

### v2.70.0 - 2024-07-16

- :rocket: `UI` Add Search boxes to admin sub-pages

### v2.69.0 - 2024-07-16

- :rocket: `API` Add suggest/forward API endpoints
- :rocket: `UI` Add mainpage support for forward geocoding

### v2.68.0 - 2024-07-15

- :rocket: `UI` Add ability to create/manage/delete Layer Templates
- :rocket: `UI` Add ability to use a layer template from the Layer Creation component
- :rocket: `API` Backend/DB changes to support Layer Templates
- :rocket: `UI` Move CoT overlay tree view to it's own component to keep the overlay component clean

### v2.67.2 - 2024-07-15

- :rocket: `UI` Distinction between refresh and connection cycle

### v2.67.1 - 2024-07-15

- :bug: `API` Fix mission data count

### v2.67.0 - 2024-07-15

- :rocket: `UI` Show Tree based filtering view for Teams
- :bug: `API` Ensure ESRI API Response is returned on errors

### v2.66.0 - 2024-07-11

- :rocket: `UI` Show Panel menu in collapsed state by default
- :rocket: `UI` Show tooltips for all menu items in default panel
- :rocket: `UI` Add alt text for login page
- :rocket: `API` Destory TLS connection for ephemeral connections if there are no more active WS connections

### v2.65.1 - 2024-07-10

- :rocket: `UI` Smarten up Share Panel

### v2.65.0 - 2024-07-10

- :rocket: Avoid small buttons with widly different functionality
- :rocket: Move 4 different creation options into human readable mode-switch buttons
- :rocket: Switch modal behavior to cards based on state of mode-switcher
- :rocket: Add ability to dynamically create Machine User (list Channels & Create User)
- :rocket: Move Agency Selection to inline
- :rocket: Add ability to delete mission data packages
- :rocket: Add ability to share mission data packages
- :rocket: Add ability to create mission data packages

### v2.64.0 - 2024-07-03

- :rocket: Add prelim support for QuickPics

### v2.63.0 - 2024-07-02

- :rocket: Automatically broadcast imported DataPackage CoTs

### v2.62.0 - 2024-07-02

- :arrow_up: Update to node-tak@9.0 to include `ackrequest`
- :bug: Fix layer redeploy endpoint

### v2.61.2 - 2024-07-02

- :arrow_up: Update to node-tak@9.8 to include Point, Poly, LineString shape support & basic styling

### v2.61.1 - 2024-07-02

- :arrow_up: Update to node-tak@9.6 to truncate coordinates to something reasonable

### v2.61.0 - 2024-07-01

- :arrow_up: Update to node-tak@9.5 to support Circles

### v2.60.0 - 2024-07-01

- :rocket: `UI` Fix stroke size in CloudTAK/Draw Rectangle
- :arrow_up: Update to node-tak@9.4 to support target cursor

### v2.59.1 - 2024-06-29

- :rocket: `UI` Fix stroke size in Layer Pane

### v2.59.0 - 2024-06-29

- :rocket: `UI` Add Video Lease Creation

### v2.58.0 - 2024-06-29

- :rocket: `API` Add basic Video Lease APIs & UI
- :rocket: `UI` Allow setting Overlay position

### v2.57.0 - 2024-06-24

- :rocket: `API` JWTs are now set to expire after 16 hours by default

### v2.56.0 - 2024-06-24

- :rocket: `API` Make a API call to ensure certificate is valid GET login

### v2.55.0 - 2024-06-24

- :rocket: `API` Make a API call to ensure certificate is valid POST login

### v2.54.0 - 2024-06-24

- :bug: `UI` Add search and paging to Task Selection

### v2.53.1 - 2024-06-24

- :bug: `UI` Fix Task Version Check

### v2.53.0 - 2024-06-24

- :rocket: `UI/API` Add Registered Tasks with READMEs

### v2.52.0 - 2024-06-21

- :rocket: `UI` Show CoTs in their appropriate layers (if any)

### v2.51.0 - 2024-06-21

- :rocket: Helper functions to get single Layer from Mission Sync Layers
- :rocket: Helper function to get `latestFeats` from single Layer
- :rocket: Perform Mission Diff on Layers

### v2.50.0 - 2024-06-20

- :rocket: `API` Add GeoFence (de)serializing support for CoTs

### v2.49.0 - 2024-06-20

- :rocket: `UI` Save redirect state when login is required
- :rocket: `UI` Add delete button to CoTView
- :rocket: `UI` Show video URL as a stopgap until RTSP streams can be viewed

### v2.48.0 - 2024-06-20

- :rocket: `UI` Allow Renaming Data Sync Layers
- :bug: `API` Add `uids` array when not present in MissionLayers API

### v2.47.2 - 2024-06-20

- :bug: `API` Add UIDs array to all UID layers

### v2.47.1 - 2024-06-20

- :bug: `UI` Fix Web Lints

### v2.47.0 - 2024-06-20

- :rocket: `UI` Add Admin page for listing Data Syncs
- :rocket: `UI` Add "Create Connection" Button in Admin Connection List

### v2.46.0 - 2024-06-20

- :bug: `API` Guidance from ARA to switch to `UID` as Data Sync type
- :rocket: `API` Support changing types automatically on a connection managed Data Sync
- :rocket: `API` Add `path` to push data to a Data Sync automatically
- :rocket: `UI` Show number of features in a UID type Data Sync UID Layer

### v2.45.0 - 2024-06-18

- :rocket: More comprehensive `rate()` parsing

### v2.44.0 - 2024-06-17

- :bug: Surface AGOL errors for addFeatures & updateFeatures
- :rocket: Batch Hook Queue submissions where possible

### v2.43.0 - 2024-06-17

- :rocket: `UI` Global Callsign now only shows as a single TextInput as newlines aren't respected
- :rocket: `API` `node-(cot|tak)` updated to latest version which uses GeoJSON simple style spec 0-1 opacity values
- :rocket: `UI/API` Update all Style Specs to use new 0-1 values
- :rocket: `UI` Add Point entry for `marker-opacity`

### v2.42.0 - 2024-06-13

- :rocket: `UI` Mission CoT updates will be posted to the correct Mission Layer

### v2.41.0 - 2024-06-13

- :rocket: `UI` Update UI to support point color and opacity
- :arrow_up: `API` Update node-cot for GeoJSON Point Styling

### v2.40.0 - 2024-06-13

- :rocket: `API` Ensure `mission_groups` is set if `All Groups` function is used when creating Data Sync
- :rocket: `UI` Disable Mission Role and set value to READONLY

### v2.39.0 - 2024-06-13

- :rocket: `API` Add indexes to Iconsets & Basemaps for user based lookup
- :rocket: `API` Update base image to Alpine 19
- :white_check_mark: `API` Updated lint globs as some files were being missed
- :bug: `await` on Hook Queue submission as errors were nuking the server
- :bug: Support mission subscriptions based on certificate subject when no SA CoT is ever sent
- :rocket: Avoid use of `attachContents` now that `<dest/>` tags are working as expected
- :rocket: Remove mission from Profile Overlay if it no longer exists

### v2.38.0 - 2024-06-11

- :rocket: Add Favicon for UI
- :rocket: Add basic Mission Sync to GROUP
- :bug: Fix bug in node-cot which resulted in only a single feature loaded from Missions

### v2.37.7 - 2024-06-07

- :rocket: `UI` Update Web Lints

### v2.37.6 - 2024-06-07

- :rocket: `UI` Small notification to let user's know packages & missions require their parent channel
- :bug: `UI` Small UI improvements in Menu headers

### v2.37.5 - 2024-06-07

- :rocket: `API/UI` Support `remarks` field of CoT with newline characters

### v2.37.4 - 2024-06-07

- :rocket: `UI` Show Layers that push to data syncs in Connection Layer list

### v2.37.3 - 2024-06-07

- :bug: `UI` Close CoT viewer if active CoT is deleted via radial menu

### v2.37.2 - 2024-06-07

- :bug: `API` Check for DataSyncs on Connection Delete to avoid 5xx error

### v2.37.1 - 2024-06-06

- :bug: `API` `GeometryZ` Column type does not automatically add `Z` coordinates and throw an error, as such manually add default values

### v2.37.0 - 2024-06-06

- :rocket: `API/UI` Switch to seconds to Layer Stale
- :rocket: `UI` Scaling of Icons/Text based on Zoom Level
- :rocket: `API` Human Readable Bad Username/Pass when trying to generate TAK Cert
- :bug: `UI` Fix preceding whitespace in remarks causing poor markdown display

### v2.36.1 - 2024-06-05

- :bug: Fix hook logging bug

### v2.36.0 - 2024-06-05

- :tada: Add `Package` Import type & auto import CoTs
- :rocket: Wire up Video Menu but note refresh is not automatic
- :rocket: `UI` Add paging for Iconsets, and set default limit to 20
- :rocket: Increase logging in ArcGIS Hook

### v2.35.0 - 2024-06-04

- :tada: `UI` Show Directional status of Groups/Channels
- :pencil2: Add external links to TAK Docs for Mission class
- :rocket: `UI` Use Mission Role for showing write functionality
- :tada: `API` Add Role/Subscription Mission APIs

### v2.34.0 - 2024-06-04

- :rocket: Store MissionToken for ProfileOverlays in new `token` column
- :rocket: Use MissionToken when it is present for all Profile based Mission API calls
- :tada: Add support for Creating & Deleting Mission Sync Layers
- :bug: Much better behavior for showing and updated subscribed state in Mission UI

### v2.33.0 - 2024-06-03

- :bug: Respect `visibility` property from ProfileOverlay on initial load
- :rocket: Add preliminary support for Mission CreateLayer
- :bug: Fix connection rename caused by mandatory `auth` that shouldn't be mandatory
- :arrow_up: Update Drizzle to latest versions
- :arrow_up: Update to bi-directional DataPackage library

### v2.32.0 - 2024-05-31

- :rocket: `API` Add sensible API limits to common fields

### v2.31.1 - 2024-05-30

- :rocket: `API` Update timeout value to allow TAK Exports

### v2.31.0 - 2024-05-30

- :rocket: `API` Run Hooks posts concurrently for increased throughput

### v2.30.0 - 2024-05-29

- :rocket: `UI` Basic support for editing CoT geometries

### v2.29.1 - 2024-05-28

- :rocket: `API` Include additional details on ESRI Server Errors

### v2.29.0 - 2024-05-28

- :rocket: `API` Add the ability for a Server Admin to export KML/KMZs

### v2.28.0 - 2024-05-23

- :rocket: `API` Add support for listing Mission Layers

### v2.27.3 - 2024-05-23

- :bug: `API` Ensure Hook failure doesn't result in API restart

### v2.27.2 - 2024-05-23

- :bug: `UI` Fix Config Page style

### v2.27.1 - 2024-05-23

- :bug: `API` Check for undefined in AGOL Token/Enabled

### v2.27.1 - 2024-05-23

- :bug: `API` Check for undefined in AGOL Token/Enabled

### v2.27.0 - 2024-05-23

- :rocket: `UI` Support entry of MultiLine Remarks fields

### v2.26.0 - 2024-05-23

- :rocket: `UI` Add support for reverse geocoding in Query Panel

### v2.25.0 - 2024-05-23

- :rocket: `UI` Mission Subscriptions are now shown immediately

### v2.24.0 - 2024-05-23

- :rocket: `API` Preliminary introduction of MissionLayers API

### v2.23.1 - 2024-05-23

- :rocket: `UI` When a mission is deleted send the user back to the Mission List page

### v2.23.0 - 2024-05-22

- :rocket: `UI` Show server connection status

### v2.22.0 - 2024-05-22

- :rocket: Significant improvements to Mission View modal => Menu

### v2.21.0 - 2024-05-20

- :rocket: Add support for validating handlebar templates

### v2.20.0 - 2024-05-20

- :rocket: `UI` Allow adding and removing Data Syncs from a given Layer
- :rocket: `UI` Remove ability to change layer connection in UI as the backend will reject these changes
- :bug: `API` Ensure Data Sync rules when `mission_diff` mode is enabled are followed by Layer Patch

### v2.19.0 - 2024-05-17

- :rocket: `UI` Significant improvements to ESRI Environment Editor
- :rocket: `API` Relaxed token requirements when working with unauthenticated ESRI Layer

### v2.18.2 - 2024-05-17

- :rocket: `UI` Make query pane reactive to re-query

### v2.18.1 - 2024-05-17

- :arrow_up: Update Depoy Deps

### v2.18.0 - 2024-05-16

- :rocket: `API` Return 400 errors for invalid CoT Features
- :rocket: `API` Allow Numbers for Speed/Course/Slope

### v2.17.6 - 2024-05-16

- :arrow_up: `API` Update node-cot to ensure proto files are included in distribution

### v2.17.5 - 2024-05-16

- :arrow_up: `API` Update node-cot to ensure proto files are included in distribution

### v2.17.4 - 2024-05-16

- :arrow_up: `API` Project wide dep update

### v2.17.3 - 2024-05-16

- :rocket: `API/UI` Ensure JSON Schemas are valid when the default DB value is used

### v2.17.2 - 2024-05-16

- :rocket: `UI` Add Import Button and redirect to Import UI for Data Package
- :rocket: `API` Add `Package` type to Import API

### v2.17.1 - 2024-05-16

- :rocket: `UI` Background Imagery changes should always stay at bottom of stack

### v2.17.0 - 2024-05-15

- :rocket: `UI` Update to latest TerraDraw which fixes required use of ts-ignore

### v2.16.0 - 2024-05-08

- :rocket: `UI` Use URL Params for CoT & Query Panel

### v2.15.0 - 2024-05-08

- :rocket: `UI` Add basic Video list in the CloudTAK Settings Panel
- :rocket: `UI` Add private/public differentiation on basemaps list

### v2.14.0 - 2024-05-08

- :bug: `API` Upgrade `node-cot` to use stricter Feature type

### v2.13.1 - 2024-05-08

- :bug: `UI` Fix externally saved vector tiles that require a `source-layer`

### v2.13.0 - 2024-05-08

- :rocket: `UI` Compliant TypeScript Definitions for pinia stores

### v2.12.0 - 2024-05-07

- :rocket: `UI` Ensure a refresh of the Mission List clears previous errors, if any
- :rocket: `API` Use consistent Mission List input types

### v2.11.0 - 2024-05-06

- :rocket: `UI` Include Map Hash in URL

### v2.10.0 - 2024-05-06

- :bug: `UI` `RadialMenu` Component was preventing backspace after use in text inputs

### v2.9.0 - 2024-05-06

- :rocket: `UI` Avoid hash in Component to reduce number of 404 on request after deploy due to cachine

### v2.8.2 - 2024-05-06

- :bug: `API` Geometry specific styles were being misapplied

### v2.8.1 - 2024-05-06

- :bug: `UI` fix use of `===` when resetting RadialMenu

### v2.8.0 - 2024-05-06

- :rocket: `API` Improved geometry parsing in ProfileFeature
- :rocket: `API` Less stringent expectations on `phone` property

### v2.7.3 - 2024-05-06

- :bug: `UI` Update `DataLayer` component to use new Layer URL Location

### v2.7.2 - 2024-05-06

- :bug: `UI` Update `data` vs `connection` dest differentiation in Layer Config

### v2.7.1 - 2024-05-06

- :bug: `UI` Ensure non-clickable underlying vector layers don't fire click events
- :bug: `UI` Fix interaction between Locked State & Radial Menu
- :bug: `UI` Fix Query Panel error on use of v-bing on Coordinates component
- :bug: `UI` Fix Query Panel error when weather could not be retrieved
- :rocket: `UI` Simplify props for MultipleSelect by using store

### v2.7.0 - 2024-05-05

- :rocket: `UI` Preliminary support for a Feature Select Modal when clicking on overlapping features
- :bug: `UI` Very rough initial fix for CoTView running off screen on smaller displays

### v2.6.1 - 2024-05-05

- :rocket: Remove `AuthGroup` CF Parameter

### v2.6.0 - 2024-05-05

- :tada: Archived features are now stored in the database and not localstorage

### v2.5.0 - 2024-05-04

- :rocket: Remove `AuthGroup` restriction allowing any TAK User to access the map page
- :tada: Add ProfileFeature database type for future archive storage

### v2.4.0 - 2024-05-03

- :rocket: `API` Complete migration by adding `NOT NULL` Constraint on `layer.connection`

### v2.3.0 - 2024-05-03

- :rocket: `UI` Display Layer & Connection status information in Admin UI

### v2.2.1 - 2024-05-03

- :bug: `UI` Ensure Admin console adds connection prefix

### v2.2.0 - 2024-05-03

- :rocket: `UI` Update UI to follow API path paradigm

### v2.1.0 - 2024-05-03

- :bug: Continue to allow System Admins to access Layer List

### v2.0.0 - 2024-05-03

- :rocket: Move Layers into their connection parent, allowing Agency level auth

### v1.29.0 - 2024-05-03

- :rocket: Automatically infer table view for Layer Environments
- :bug: Set Backup window to ensure it doesn't conflict with maintenance window

### v1.28.0 - 2024-05-03

- :rocket: Include Preferred DB Maintenance Perdiod

### v1.28.0 - 2024-05-01

- :rocket: `UI` Allow Icons to take affect when selected via CotStyle Component
- :rocket: `UI` Add unified `cot.style` method for universally handling feature properties on add or update

### v1.27.0 - 2024-05-01

- :rocket: `UI` Add ability to remove Icon from Feature
- :bug: Make iconset selection dark to avoid being a common icon colour (white)

### v1.26.1 - 2024-05-01

- :arrow_up: `API` Update node-cot to support `sensor` and `video` tags

### v1.26.0 - 2024-04-30

- :rocket: `API/UI` Add ability to spin up Video Servers

### v1.25.1 - 2024-04-30

- :rocket: `UI` Redirect to Media Server List on 404
- :rocket: `API` Handle invalid Media Server ID with 400
- :rocket: `API` Handle not foudn Media Server ID with 404

### v1.25.0 - 2024-04-30

- :rocket: Allow Deleting Media Management Servers

### v1.24.0 - 2024-04-30

- :tada: Basic support of a Media Management Server System

### v1.23.2 - 2024-04-30

- :rocket: Move release script to inline GH Action

### v1.23.1 - 2024-04-30

- :bug: `UI` Force a re-render of CoT view if a new cot is clicked

### v1.23.0 - 2024-04-29

- :bug: `UI` Fix patch updating GeoJSON sources as the wrong format was being used for updates
- :tada: `UI` Style features in place and avoid using additional layers for styling

### v1.22.3 - 2024-04-29

- :bug: `API` Fix bug where generated object wouldn't be returned

### v1.22.2 - 2024-04-28

- :bug: `UI` Fix CoTs being moved to active Map upon render

### v1.22.1 - 2024-04-28

- :bug: `UI` Fix config being written by value of single key

### v1.22.0 - 2024-04-28

- :rocket: `UI` Allow storing pre-defined key/values to power the Config API

### v1.21.1 - 2024-04-28

- :bug: `UI` Retain FeatureCollection generation for non-default CoT store

### v1.21.0 - 2024-04-28

- :rocket: `UI` Support for partial updates (or no updates) to map, resulting in a faster map experience

### v1.20.1 - 2024-04-26

- :rocket: Continue working on reducing drift

### v1.20.0 - 2024-04-26

- :rocket: `API` Lock Connections to System or Agency Admins
- :rocket: `API` Lock Connections Data Sync Resources to System or Agency Admins
- :rocket: `UI` Add paging to ConnectionToken page to be consistent with other pages
- :bug: `UI` Avoid styling `group` CoT Markers to avoid green circle under group indicator

### v1.19.1 - 2024-04-25

- :bug: `API` Fix Connection name filtering

### v1.19.0 - 2024-04-23

- :rocket: `API` Make DataSync Delete fault tolerant to TAK Server Errors

### v1.18.0 - 2024-04-23

- :rocket: `UI` Menu Coverage Effects
- :rocket: `API` SystemAdmin shows all connections on server
- :rocket: `API` AgencyAdmin shows only connections they are admin of
- :rocket: `API` User shows no connections

### v1.17.4 - 2024-04-23

- :bug: Fix version numbers in this file

### v1.17.3 - 2024-04-23

- :bug: `ui` Style Queries wouldn't update after initial create

### v1.17.2 - 2024-04-23

- :bug: `ui` Fix bug in underlying Input library that prevented event firing on select => delete

### v1.17.1 - 2024-04-23

- :bug: `api` Avoid deleting style properties as style object is reused

### v1.17.0 - 2024-04-22

- :bug: `Hooks` If a `remarks` field isn't present, post an empty string
- :tada: `UI` Add Adgency/Server badge for connections
- :tada: `UI` Add `AgencySelect` component for adding/removing agencies
- :rocket: `API` Allow updating/removing agencies on a connection

### v1.16.0 - 2024-04-22

- :bug: `API` Fix Style Overrides

### v1.15.1 - 2024-04-21

- :bug: `UI` Fix icon stretch in CoT Pane

### v1.15.0 - 2024-04-21

- :tada: `API` Connection now has an optional `agency` column with auth checks
- :tada: `API` Initial API Scoping for new `/agency` route
- :tada: `UI` Add `start`, `stale`, `time` in CoT view by default

### v1.14.0 - 2024-04-20

- :tada: Add Manual Coordinate Entry box and Drawing button improvementst

### v1.13.0 - 2024-04-19

- :tada: `UI` Support HTTP Links in the CoTViewer
- :tada: `UI` Support Dynamically generating HTTP Links in Style Editor

### v1.12.1 - 2024-04-19

- :bug: `UI` Remove style properties in request when `enabled` is not checked

### v1.12.0 - 2024-04-19

- :tada: `UI` Significant changes to Layer Style Editor
    - Allow Global Callsign Remarks
    - Allow Global Styling
    - Query styles are optionally applied after global styling
    - If a query is not successful it is gracefully passed over
- :rocket: `API` Update Style schema to support global styles
- :rocket: `API` Improve behavior if underlying LogStream isn't created or is missing
- :rocket: `UI` Remove Create Layer buttons from non-connection page

### v1.11.0 - 2024-04-18

- :rocket: `API` Add support for parsing `ackrequest` in CoT messages

### v1.10.0 - 2024-04-18

- :rocket: `API` Add `remarks` field as default column in ESRI Sink
- :rocket` `API` Significant refactor of `ESRI.addLayer` function to support new layer builder for future dynamic layers
- :bug: Gracefully handle invalid jsonata query by returning 4xx instead of 5xx

### v1.9.0 - 2024-04-18

- :rocket: `UI` Automatically convert http(s) URLs to clickable links in remarks field

### v1.8.0 - 2024-04-18

- :rocket: `UI` Error check Style Queries in browser and display as TablerInput Error
- :bug: `UI` Ensure editing a query doesn't result in a duplicate being created

### v1.7.0 - 2024-04-18

- :bug: `UI` Small papercut fixes to ESRI viewer
- :rocket: `API` Continue to handle a wider variety of ESRI Server Configurations

### v1.6.1 - 2024-04-18

- :rocket: `UI` Surface ESRI Type (MapServer/FeatureServer/etc) in ESRI Server List UI
- :rocket: `UI` Fix text spacing in Connection Tables

### v1.6.0 - 2024-04-17

- :rocket: `UI` Push to overlays menu upon adding a new overlay
- :rocket: `API` Allow admins to flip iconsets between public/private
- :rocket: `UI` Differentiate between Private & Public Iconsets in UI
- :tada: `API` Add preliminary support for server-wide default overlays
- :tada: `API` Add preliminary support for setting server config that are used internally such as Search API Tokens
- :rocket: `UI` Add tooltips to nav panel in upper right hand corner of CloudTAK
- :bug: `UI` Remove one last instance of `window.std` vs imported `std` call
- :rocket: `UI` Add server config section of Admin Panel
- :rocket: `Events` Generate temporary token for imports with scope defined by `username`

### v1.5.0 - 2024-04-17

- :bug: `API` More generic fallbacks for parsing ESRI Enterprise Server URLs
- :arrow_up: `Events` Update all deps
- :rocket: `Events` Update to Flat ESLint Config and lint api calls

### v1.4.2 - 2024-04-17

- :bug: `UI` When uploading an Iconset Zip, redirect to correct import page

### v1.4.1 - 2024-04-17

- :bug: `UI` Avoid CloudTAK Init error if no basemap is configured

### v1.4.0 - 2024-04-16

- :rocket: `UI` Remove ARCGIS_TIMEZONE option now that config.timezone does the same thing generically

### v1.3.3 - 2024-04-16

- :rocket: Attempt to get GH Actions releaser to include CHANGESET entries

### v1.3.2 - 2024-04-16

- :rocket: Attempt to get GH Actions releaser to include CHANGESET entries

### v1.3.1 - 2024-04-16

- :rocket: Attempt to get GH Actions releaser to include CHANGESET entries

### v1.3.0 - 2024-04-16

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

