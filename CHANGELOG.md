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

### v12.75.5 - 2026-02-14

- :bug: Include legacy style properties to avoid color issues in iTAK

### v12.75.4 - 2026-02-13

- :bug: Fix Circle Colour Parsing

### v12.75.3 - 2026-02-13

- :bug: Fix Circle Generation when using the Circle Tool

### v12.75.2 - 2026-02-12

- :bug: non-admin users would not be able to access the config API and result in a failed login

### v12.75.1 - 2026-02-11

- :bug: Use `login::logo` in Main Menu

### v12.75.0 - 2026-02-11

- :rocket: Rewrite config APIs to allow for more flexible configuration management and retrieval in the future, while maintaining backwards compatibility with existing config keys and structures
- :rocket: Frontend now caches config values to avoid unnecessary API calls and improve performance
- :bug: Fix bug where contacts list would refresh indefinitely

### v12.74.0 - 2026-02-10

- :rocket: Add support for filtering by groups in Data Sync List API

### v12.73.1 - 2026-02-09

- :rocket: Improve Login Service Worker UI
- :bug: CloudTAK API Token would replace Mission API Token if a PATCH request was made to the Dexie Database
- :bug: When unsubscribing from a Password Protected Mission, return to Data Sync list as you no longer have a token to view the mission which resulted in a frontend error
- :bug: Avoid posting `template:null` to missions with no templates

### v12.73.0 - 2026-02-08

- :rocket: Implement an "Escape Hatch" to delete the Service Worker from the login page via a UI entry @LizDepew
- :tada: Show unread Mission Log in the UI via a badge system

### v12.72.1 - 2026-02-08

- :rocket: Show Date/Time on Chat Messages

### v12.72.0 - 2026-02-08

- :bug: When a Data Sync Subscription is refreshed, trigger a re-render event
- :tada: Implement SubscriptionChange table and allow liveQuery Menus
- :tada: Revant "Active Mission" UI to allow quicker access to active mission contents
- :tada: Revant Mission Files Pane to allow viewing photos inline and standarding file components

### v12.71.1 - 2026-02-07

- :bug: Fix data type that resulted in Missions not being able to invite new users
- :bug: Fix bug that prevented display of "New Folder" button in the Mission Features tab

### v12.71.0 - 2026-02-06

- :bug: Fix critical bug where a new Basemap could potentially fail, causing the user not to be able to login

### v12.70.0 - 2026-02-04

- :tada: Allow hiding a Basemap or Overlay
- :rocket: Only allow snapping for public tilesets hosted on S3
- :tada: Allow specifying a snapping layer when drawing a line if a snapping layer exists
- :tada: Allow snapping to a given overlay

### v12.69.1 - 2026-02-03

- :bug: stricter kmz parsing to ensure zipped kmls can still be imported

### v12.69.0 - 2026-02-03

- :rocket: `UI` Update section menus in AdminConfig UI
- :tada: Allow config API to specify a default basemap
- :rocket: Update `/api/config/map` to return the default basemap ID
- :rocket: Strongly type /api/config response objects
- :white_check_mark: Add checks to ensure integrity of default basemap

### v12.68.1 - 2026-02-03

- :arrow_up: Update NodeCoT to support `<uid/>` without droid property

### v12.68.0 - 2026-02-02

- :tada: Mimick LongPress events to open Context Radial on Touch Devices

### v12.67.3 - 2026-02-02

- :rocket: Change default Mission List order to newest => oldest

### v12.67.2 - 2026-02-02

- :bug: Ensure Content-Encoding in API Gateway context is always set correctly by sniffing the actual contents of the buffer returned by the PMTiles Class

### v12.67.1 - 2026-02-02

- :bug: Internally create a slice to avoid an unimplemented error

### v12.67.0 - 2026-02-02

- :rocket: Standardize `/tiles` endpoint for retrieving per-tile data
- :rocket: Fixes to binary/gzip parsing of tiles in the PMTiles context

### v12.66.0 - 2026-01-31

- :tada: Allow setting menu visibility per user profile

### v12.65.0 - 2026-01-31

- :tada: Show an Import Result list in the Admin Imports page

### v12.64.0 - 2026-01-31

- :tada: Introduce an Import Result Type
- :tada: Add Import Results as they are created in the import flow

### v12.63.0 - 2026-01-28

- :bug: Fix bug where if a GeoChat was sent to a Data Sync the entire change API would become corrupted due to a server schema mismatch
- :tada: Add an IconMessage for GeoChat DataSync changes
- :rocket: Update `batch-schema` to dump outgoing objects to the log if they fail the outgoing schema

### v12.62.1 - 2026-01-28

- :bug: Fix bugs related to KMZ icons with `.`
- :bug: Fix bug in sprite loading in UI

### v12.62.0 - 2026-01-27

- :rocket: Add `snapping` to overlay features API response
- :rocket: Reduce log verbosity when deployed in AWS Lambda for PMTiles calls
- :rocket: Allow direct Connection Feature PUT requests outside of the submit
- :white_check_mark: Add Connection Feature Tests

### v12.61.1 - 2026-01-24

- :rocket: Show ESRI Geometry Type in Server Explorer

### v12.61.0 - 2026-01-24

- :rocket: Migrate to ProfileConfig model for storing user profile settings.
- :tada: Add frontend ability to reorder profile sections via drag-and-drop.
- :rocket: Migrate FeatView to use Menu model for better navigation. Closes: https://github.com/dfpc-coe/CloudTAK/issues/1128 https://github.com/dfpc-coe/CloudTAK/issues/880
- :bug: Fix MainMenu resize on a touch screen.
- :rocket: Use ServiceWorker version as displayed version with fallback to package.json version
- :rocket: Remove LoginModal - Closes: https://github.com/dfpc-coe/CloudTAK/issues/1178

### v12.60.0 - 2026-01-21

- :rocket: Allow the import system to import Basemaps

### v12.59.1 - 2026-01-20

- :rocket: Enable KMS Rotation & Explicit Bucket Encryption on S3 Buckets

### v12.59.0 - 2026-01-18

- :tada: Presence of the lower left logo is configurable (default, custom, disabled)
- :tada: Logo itself is customizable
- :tada: "Username" text can be configured - IE "Callsign" in the above or "Username/Email", "Email" etc Closes: https://github.com/dfpc-coe/CloudTAK/issues/1201
- :tada: Background color is configurable, note there is a fade animation as the CSS baked into the page is loaded several seconds before the API calls complete to actually load up the custom stuff
- :bug: Check VueRouter on login redirect and fallback to window.location if not using VueRouter

### v12.58.0 - 2026-01-16

- :tada: Additional Consolidaton of COTAK API Calls
- :rocket: Add Icon for "Type" (Delete vs Style) of Query in ETL Style Editor
- :rocket: Visual Improvements to ETL Style Editor

### v12.57.0 - 2026-01-15

- :tada: Internal Implementaton of Route Snapping (Not yet exposed in UI)
- :rocket: Allow preset Keywords in Mission Template
- :rocket: Alow preset Keywords in Mission Template Log

### v12.56.0 - 2026-01-14

- :tada: Implement Mission Template Log UI in Data Sync

### v12.55.1 - 2026-01-13

- :rocket: Surface Recent Missions first by default
- :white_check_mark: Add Mission List tests

### v12.55.0 - 2026-01-12

- :rocket: Output Web Types as an npm package for use in CloudTAK Plugins
- :rocket: Update `std` calls to instead use `server` for stronger type security

### v12.54.0 - 2026-01-09

- :tada: Add `type` and `multi` parameters for choosing shape of data returned by PMTiles Feature APIs

### v12.53.1 - 2026-01-09

- :arrow_up: Update TerraDraw

### v12.53.0 - 2026-01-09

- :bug: Ensure updates that are PATCHed to server also are updated in the UI when toggling back to read-only view
- :tada: Include an optional `name` field in filter to describe/retain intent
- :tada: Introduce new QueryInput for validating JSONata queries on the frontend
- :rocket: Update Style & Filter UIs to use new unified QueryInput
- :bug: Fix issue where logs would continue to be loaded outside of the Deploy tab
- :rocket: Show Outgoing config by default if an outgoing config is present but no incoming config.

### v12.52.0 - 2026-01-08

- :rocket: Strongly Validate Connection Key Pair

### v12.51.2 - 2026-01-08

- :arrow_up: Update VueTabler to allow breadcrumbs to route accross PWA Router Boundaries

### v12.51.1 - 2026-01-08

- :bug: Don't return an iconset object in transform worker if there are no iconset
- :bug: Don't create iconset object via API if iconset object doesn't exist or if the size is 0
- :bug: Ensure iconset loading failure doesn't prevent overlay loading

### v12.51.0 - 2026-01-08

> [!WARNING]
> TAK Server has a bug that prevent Data Sync invites from working.
> For new Data Sync invite features to function, TAK Server must be updated
> to 5.6-RELEASE-8 or newer.

- :tada: `API` Introduce Pending Invites list in Data Sync API
- :rocket: `UI` Show Pending Invites UI in Data Sync List and allow accepting or rejecting them
- :rocket: `UI` Support the Mission Invite CoT message and show a modal to accept/reject invites when received over CoT

### v12.50.0 - 2026-01-06

- :rocket: Allow editing MenuFeature folder names
- :rocket: Allow creating new folders in MenuFeature
- :rocket: Improve usability of dropping features
- :rocket: Wrap instead of truncating feature names
- :bug: Parallel Overlay creation could result in the final visual layers being out of order, causing rendering issues in the final output.
- :bug: Fix Draw Popup not displaying

### v12.49.0 - 2026-01-06

- :rocket: `UI` Add `feature` and `map` APIs for Plugin use

### v12.48.0 - 2026-01-05

- :rocket: `UI` Store CoT features in DexieDB on update call for future full migration out of memory into Dexie
- :rocket: `UI` Load Overlays in Parallel for faster map initialization
- :rocket: `API` Refactor `External` class into a generic `interface-user` for future implementations that reference other user providers: Ref: https://github.com/dfpc-coe/CloudTAK/issues/1180
- :rocket: `API` Refactor Weather class into a generic `interface-weather` for future implementations that reference other weather providers, maintaining the current hardcoded NOAA => OpenMeteo fallback

### v12.47.2 - 2026-01-04

- :bug: Add Partition Parameter to allow non-commercial AWS regions to deploy CloudTAK

### v12.47.1 - 2026-01-04

- :rocket: Add `DependsOn` sections to CloudFormation to ensure consistent deploy order
- :rocket: Add badge to show number of online users per subgroup in MenuContacts

### v12.47.0 - 2026-01-04

- :tada: `api`  Introduce MissionTemplateLog APIs for managing Log Templates
- :tada: `UI`  Introduce Admin Interface to a UI driven approach to generating Log Templates
- :tada: `infra` Introduce EFS file system for PMTiles Library
- :tada: Introduce automated deletion polcy via lambda task for 7 day retention of files in EFS FS
- :tada: Introduce Menu & Router APIs in frontend plugin system

### v12.46.0 - 2026-01-03

- :tada: Introduce Mission Template Logs in API
- :rocket: Standardize Connection Card in UI
- :rocket: Introduce `menu` operations to PluginAPI

### v12.45.0 - 2026-01-02

- :arrow_up: Update NodeCoT

### v12.44.1 - 2026-01-01

- :arrow_up: Update TerraDraw

### v12.44.0 - 2026-01-01

- :tada: KML HTML Description Support

### v12.43.0 - 2026-01-01

- :bug: SVG icons in an Iconset would result in an invalid iconset.zip being generated
- :bug: Iconset.zip would have the raw data URL instead of just the PNG buffer
- :white_check_mark: Add strong unit testing to iconset.zip generation to ensure functionality
- :rocket: Automate populate of API URL env vars in cloudtak.sh install manager

### v12.42.0 - 2025-12-31

> ![WARNING]
> This Version of CloudTAK requires updating to `vpc@2.10.0` or above if using the provided CloudFormation templates.
>
> If using the provided templates, ETLs must be updated to point at the per-stack ECR provided by the new VPC module.

- :rocket: Update ECR Repo structure

### v12.41.0 - 2025-12-31

- :tada: MVP support for Iconsets created during Imports
- :bug: Fix Basemap Menu appearing below Basemap List
- :rocket: More aggressive warning message and requirements to delete Data Sync
- :rocket: Support `.json` and `.geojson` extension in Import Task
- :rocket: Support Line Delimited AND Standard GeoJSON in Import Task

### v12.40.0 - 2025-12-30

- :rocket: Setup ETL Builder in bin/build
- :bug: Move from `docker down` to `docker stop` in cloudtak.sh

### v12.39.0 - 2025-12-26

- :rocket: Make Chatroom List Live
- :rocket: Make Chats List Live
- :rocket: Update Chat delete call to use message_id instead of Database ID
- :arrow_up: Update VueTabler@4 to use typescript based components

### v12.38.0 - 2025-12-24

- :bug: Fix issue where icons with Folders would fail to be fetched
- :rocket: Implement LockOn functionality from CoTView - Closes: https://github.com/dfpc-coe/CloudTAK/issues/1136

### v12.37.0 - 2025-12-23

- :bug: Ensure Readable Stream is passed to Data Package and not File Path
- :white_check_mark: Add Unit Tests

### v12.36.0 - 2025-12-23

> [!WARNING]
> This Version of CloudTAK requires updating to `vpc@2.9.0` or above if using the provided CloudFormation templates.
> Docker Compose or custom deployments do not require any action.
>

- :rocket: Update to use per-environment ECR repositories for improved security and isolation
- :rocket: Update to use CloudFormation managed ACM Certificates for improved security and easier management

### v12.35.0 - 2025-12-22

- :white_check_mark: Remove `tape` in favour of `node:test`

### v12.34.0 - 2025-12-22

- :rocket: Migrate to unified Package Listing Endpoint
- :rocket: Allow use of Server Certificate via `impersonate` query param
- :rocket: Update ServerPackage UI to allow filtering
- :rocket: Update ServerPackage UI to allow downloading packages

### v12.33.2 - 2025-12-19

- :rocket: Add a cleanup section to remove danging Docker Images after an update

### v12.33.1 - 2025-12-17

- :bug: Fix a bug where a DataPackage would fail to import due to mismatched extensions

### v12.33.0 - 2025-12-16

- :tada: Significant Revamp of the Query Endpoints

### v12.32.0 - 2025-12-16

- :rocket: Initial Implementation of TAK Server Sharing

### v12.31.0 - 2025-12-15

- :bug: RadialMenu could error when using a VectorTile encoded GeoJSON Centroid
- :bug: Continue to improve Video Player error handling

### v12.30.0 - 2025-12-15

- :rocket: Migrate RadialMenu to Popup

### v12.29.0 - 2025-12-15

- :arrow_up: Update Dockerfiles to use Alpine@23
- :arrow_up: Update NodeJS requirements to use NodeJS@24

### v12.28.0 - 2025-12-15

- :rocket: Migrate UI Items to use StandardItem Component
- :rocket: Use MapLibre-GL-JS Popups for MultipleSelect to allow map actions without losing context
- :rocket: Store `format` seperately from name for Icons to allow the map layer to consistently request `png` regardless of original upload format
- :rocket: Add Breadcrumb support to BaseMap Menu
- :tada: Significant improvements to UI For Global Search

### v12.27.2 - 2025-12-12

- :rocket: Merge Video Error Handling into single block
- :rocket: Avoid requesting the same time in the stream that caused an error

### v12.27.1 - 2025-12-12

- :rocket: Add ability to recover from Buffer Error

### v12.27.0 - 2025-12-12

- :rocket: UI Improvements to CoT View

### v12.26.0 - 2025-12-10

- :rocket: Version Fix

### v12.25.0 - 2025-12-10

- :tada: Show assigned personnel in CoT section

### v12.24.1 - 2025-12-10

- :arrow_up: Update MediaInfra Container

### v12.24.0 - 2025-12-09

- :bug: Don't allow editing Mission Description unless subscribed
- :rocket: Avoid reloading MenuContacts on refresh message (@CoryFoy)
- :rocket: Avoid clearing MenuContacts on refresh as it flashes a TablerNone component (@CoryFoy)

### v12.23.2 - 2025-12-06

- :arrow_up: Add Support for Links in NodeCoT

### v12.23.1 - 2025-12-06

- :rocket: Improve FeatureCollection extraction performance on PMTiles API

### v12.23.0 - 2025-12-06

- :tada: Introduce FeatureCollection extration on PMTiles API

### v12.22.0 - 2025-12-05

- :rocket: Improvments to NGINX config to ensure JS files are returned with the proper MIME type
- :rocket: Improvments to Service Worker to log caching issues
- :bug: Fix redirect on HTML files to invalid port

### v12.21.0 - 2025-12-05

- :tada: introduce placeholder Robots.txt

### v12.22.0 - 2025-12-04

- :tada: Introduce Notification Filtering of active notifications by type

### v12.21.0 - 2025-12-04

- :rocket: Check for SW updates on Login Page
- :tada: Allow editing Missions

### v12.20.0 - 2025-12-03

- :bug: Fix group selection bug in underlying node-tak library
- :tada: Implement MissionTemplate selection in Data Sync creation flow
- :rocket: Standardize use of Keywords Array

### v12.19.0 - 2025-12-02

- :tada: Introduce MissionTemplate Admin UI for creating Data Sync Templates
- :bug: Fix nginx loading of admin.html & connection.html in single page app mode
- :rocket: Remove Service Worker in Admin and Connection UIs to avoid caching issues

### v12.18.0 - 2025-12-01

- :rocket: Catch and display codec errors in Video Player

### v12.17.1 - 2025-12-01

- :rocket: Continue to iterate on automated Service Worker Updates

### v12.17.0 - 2025-12-01

- :rocket: To reduce the chunk sizes and flow complexity, this PR moves the following route sets to their own SPAs
    - All routes prefixed with `/admin`
    - All routes prefixed with `/connection`
- :bug: Ensure 4xx error from PATCH Layer Incoming Config is thrown -- @adrienhoff

### v12.16.0 - 2025-12-01

- :rocket: Remove fixed platform tag

### v12.15.5 - 2025-11-30

- :bug: Ensure file/src exists in SW

### v12.15.4 - 2025-11-30

- :bug: Update Self Invocation

### v12.15.3 - 2025-11-30

- :bug: Update Self Invocation

### v12.15.2 - 2025-11-30

- :bug: Force a refresh on service worker update to avoid caching issues

### v12.15.1 - 2025-11-30

- :bug: Stronger avoidance of bad HTML caching in SW

### v12.15.0 - 2025-11-30

- :tada: Allow exporting Mission Logs as CSV

### v12.14.0 - 2025-11-30

- :tada: Allow editing Mission Log DTG values after posting
- :rocket: Migrate MissionLog to it's own component for encapsulation

### v12.13.0 - 2025-11-29

- :bug: Fix service worker install due to caching unnecessary files

### v12.12.1 - 2025-11-26

- :rocket: Additional permissions checks for viewing Leased Streams:

### v12.12.0 - 2025-11-26

- :rocket: Merge Icon editing into single sidebar component
- :rocket: Migrate API from using name as primary key to icon ID to allow renaming icons
- :rocket: Stronger Validation checks on Icon POST/PATCH
- :rocket: Store Icon Buffers as Base64 encoded Data URL
- :tada: Allow uploading SVG icons

### v12.11.5 - 2025-11-25

- :rocket: Update MediaInfra Container

### v12.11.4 - 2025-11-25

- :rocket: Continue to refine VideoLease permission parameters

### v12.11.3 - 2025-11-25

- :white_check_mark: Add Video Lease Creation Test

### v12.11.2 - 2025-11-24

- :rocket: Small permission changes to VideoActive endpoint

### v12.11.1 - 2025-11-24

- :rocket: Fix Changelog version

### v12.11.0 - 2025-11-24

- :tada: Reimplement Iconsets Menu for visual consistency
- :rocket: Allowing CloudTAK specific icon overrides, while visually pleasant violated the Common in COP and was never implemented in operational use as it resulted in a large visual deviation from TAK EUD clients.
- :rocket: Icon Menu updates for visual consistency
- :rocket: Load Iconset Database into memory
- :rocket: Migrate NotificationType from String to Enum

### v12.10.0 - 2025-11-24

- :rocket: Unsubscribe Mission make inactive - Closes: https://github.com/dfpc-coe/CloudTAK/issues/944
- :tada: Store current active state in the DB to ensure it is retained across restarts

### v12.9.0 - 2025-11-23

- :tada: Intercept CTRL+F and open Search Box

### v12.8.0 - 2025-11-23

- :tada: Allow setting style properties on Range Ring Creation
- :rocket: Update Basemap Menu to new Item Style
- :rocket: Update Route Menu to new Item Style

### v12.7.0 - 2025-11-21

- :rocket: Fix some padding issues in menu
- :rocket: Better Settings Menu Style
- :rocket: Better Chats Menu Style
- :rocket: Better API Token Menu Style
- :rocket: Avoid Caching CrossOrigin ServiceWorker requests

### v12.6.0 - 2025-11-20

- :tada: Complete rewrite of Service Worker to completely cache map frontend
- :tada: Custom Build/Version support for ServiceWorker Updates
- :tada: 5sec `status` updates on WebSocket that include version numbers so service worker can be updated if underlying version changes
- :tada: Group Data Packages with the same UID as they are "revisions"
- :rocket: Allow filtering by Data Package Name
- :rocket: Fix bugs related to UID vs Hash and remove the need for a ?hash parameter in the frontend routes
- :rocket: Allow CloudTAK Admins to delete all Data Packages, regardless of ownership
- :tada: Rewrite Mission Info Pane in a similiar style to DataPackage.vue

### v12.5.1 - 2025-11-18

- :rocket: Remove smaller DB sizes that aren't compatible with Aurora Postgres

### v12.5.0 - 2025-11-18

- :rocket: Refine Mobile Detection to match Bootstrap 5
- :tada: Use TablerModal when in mobile mode
- :rocket: Add Preserve History option for Outgoing ArcGIS Layers

### v12.4.1 - 2025-11-18

- :arrow_up: Update MediaServer@7.1.0

### v12.4.0 - 2025-11-17

- :rocket: Add support for Spotted CoTs
- :rocket: Ensure an Overlay can't be added twice from Overlay Explorer
- :bug: Don't allow XML Download is Basemap Sharing is disabled

### v12.3.2 - 2025-11-17

- :white_check_mark: Add Basemap ArcGIS FeatureServer Tests

### v12.3.1 - 2025-11-17

- :white_check_mark: Add Basemap ArcGIS Tests

### v12.3.0 - 2025-11-17

- :rocket: Improve UI of Overlays Menu
- :rocket: Improve UI of Overlays Explorer Menu
- :rocket: Improve UI of Data Syncs

### v12.2.2 - 2025-11-14

- :rocket: Increase PMTiles Timeout

### v12.2.1 - 2025-11-14

- :white_check_mark: Add Attachment Integration Tests

### v12.2.0 - 2025-11-14

- :tada: Update Menu Styling and allow choosing between list and menu view
- :bug: Fix bug in MissionLog DTG generation
- :rocket: Update styling of DataPackage view

### v12.1.0 - 2025-11-14

- :rocket: Detect if coordinates are entered in SearchBox and allow selection

### v12.0.3 - 2025-11-13

> [!WARNING]
> If using the provided CloudFormation templates, update to 12.0.2 first and follow the deploy
> notes there before updating to 12.0.3
>
- :tada: Remove old single instance RDS instance - note you will have to remove delete projection and remove manually from console, a snapshot is recommended before deletion.

### v12.0.2 - 2025-11-13

> [!WARNING]
> This release updates the underlying database to AWS Aurora-Postgres
> It automatically updates the POSTGRES endpoints to use the new cluster endpoints
> but does not replace/remove the old RDS instances. The next versioned release
> will remove the old RDS instances.
>
> A manual database migration is required if using our provided CloudFormation templates
> https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraPostgreSQL.Migrating.html

- :tada: Migrate to AWS Aurora-Postgres for improved performance and scalability

### v12.0.1 - 2025-11-13

- :bug: Fix interconnected service loop that could occur, resulting in slow API responses

### v12.0.0 - 2025-11-13

> [!WARNING]
> If using the CloudTAK Media-Infra, you must update to v7.0.0 or above to ensure compatibility with this release.
> If you are not using Media-Infra, no action is required.

- :tada: Greatly improved performance in HLS Media Proxying

### v11.53.1 - 2025-11-05

- :bug: Pin Swagger Dist to avoid react error

### v11.53.0 - 2025-11-04

- :tada: Allow adding Basemap Imagery as an overlay

### v11.52.0 - 2025-11-04

- :tada: Add WebSocket update for Import Success/Failure
- :white_check_mark: Add Integration Tests for Import WebSocket updates
- :rocket: Improve Notifcation Toast by making it clickable
- :rocket: Dismiss Toast if clicked or closed

### v11.51.0 - 2025-11-04

- :tada: Add support for notifications being able to register themselves as Toasts
- :rocket: Migrate entire Notification system out of memory and into IndexDB

### v11.50.0 - 2025-11-03

- :rocket: Remove Layer Alerts which is a feature that hasn't been used in over 2 years
- :rocket: Closes: https://github.com/dfpc-coe/CloudTAK/issues/1059
- :rocket: Closes: https://github.com/dfpc-coe/CloudTAK/issues/1060
- :rocket: Continue to improve and iterate on Layer Template support

### v11.49.0 - 2025-10-31

- :rocket: Automatically generate a SigningSecret & MediaSecret when using CloudTAK Install script
- :bug: Fix ECR Task List Permissions

### v11.48.0 - 2025-10-30

- :tada: A complete rewrite of how Data Syncs are managed under the hood by using IndexDB as storage
- :rocket: Data Sync Logs are now "live" due to the above change
- :rocket: Improve performance of Data Syncs with large numbers of features
- :tada: Add the ability to specify a refresh requency for overlays
- :bug: Fix file names in downloaded Data Sync Files

### v11.47.0 - 2025-10-21

- :rocket: Internally update all GET Layer operations to Layer Control class for consistency in checks
- :rocket: Make Environment/Schema/Style UI Panes on Outgoing ETLs resilient to partial Capability Failures

### v11.46.0 - 2025-10-21

- :rocket: Perform a Regex pattern match on Layer Tasks on creation
- :rocket: Ensure the Task image exists in the ECR before deploying

### v11.45.0 - 2025-10-20

> [!CAUTION]
> ETLs should be updated to use `@tak-ps/etl@9.22.0` or above. Failure to update this dependency will cause the ETL Layer Get operations to fail with a schema error.

- :rocket: Remove `stale` value from LayersIncoming and place it where it belongs in the `styles` layer
- :bug: Allow previewing attached images with capital letters as the extension - IE `.JPG`
- :tada: Implement `minzoom` & `maxzoom` properties in the Style Editor

### v11.44.0 - 2025-10-17

- :rocket: Update all filter expressions to the modern syntax
- :rocket: Add the ability for features to control their display via a min/max zoom property

### v11.43.0 - 2025-10-17

- :rocket: Limit height of notification pane and allow scroll if notificatons overflow
- :rocket: Simplify entry of configure options in the UI (Underlying API is unchanged)

### v11.42.3 - 2025-10-17

- :bug: `UI` Enforce a truststore password

### v11.42.2 - 2025-10-17

- :rocket: `UI` Support Line Style on Polygon Edges

### v11.42.1 - 2025-10-16

- :bug: `API` Filter out undefined header values

### v11.42.0 - 2025-10-16

- :rocket: `UI` Add generic image in Imports list as a fallback
- :rocket: `UI` Show Share toggle for Basemaps
- :rocket: `UI` Hide sharing button if sharing has been disaabled for a Basemap
- :tada: `UI` Automatically proxy shared basemap URLs if they are not supported by the majority of clients - IE ESRI Image/Map/Feature Servers
- :white_check_mark Add Basemap Sharing Integration Tests

### v11.41.0 - 2025-10-13

- :rocket: Add KMS export & Geofence Secrets
- :bug: `UI` Fix display of agency information in Connection UI
- :tada: `API` Move Font serving to an API operation to facillitate graceful fallback when requested font glyphs are unavailable.

### v11.40.0 - 2025-10-10

- :rocket: Remove unused ProfileMission Table
- :tada: Add ability to share to Data Sync Mission
- :rocket: `UI` Truncate Mission Content values
- :tada: Implement Server Package List
- :arrow_up: Update node-cot to add additional optional fields

### v11.39.0 - 2025-10-07

- :rocket: Wrap Mission Logs to ensure they are fully visible - Closes: https://github.com/dfpc-coe/CloudTAK/issues/1022
- :tada: Allow editing Mission Logs
- :rocket: Add `deletable` prop in CopyField.vue
- :bug: Fix PATCH Mission Log API, the underlying API Call in node-tak didn't include the log ID

### v11.38.0 - 2025-10-07

- :tada: Introduce a Bash Script for managing Docker Compose based deployments

### v11.37.0 - 2025-10-07

- :bug: Fix an issue & add unit tests for a case when an uploaded DataPackage would be treated as a file within a data package instead of an existing one
- :bug: Short circuit on ConnectionFeature insertion if there are no features to insert

### v11.36.0 - 2025-10-06

- :rocket: Internally buffer Connection Features

### v11.35.0 - 2025-10-02

- :bug: Handle Zipped Zips as a KMZ can be inside a DataPackage or the DataPackage can BE the KMZ

### v11.34.0 - 2025-10-02

- :bug: When Sharing to a mission the `skip_network` flag would prevent the CoT from actually being added to the mission over the network, resulting in the CoT being lost when the user refreshed their page. This version fixes this issue by setting the authored flag to true when adding to a mission.
- :rocket: `UI` Show a `clear` button when text is entered into a search box
- :rocket: `UI` Allow the user to show their password in plaintext with an `eye` button on password fields.

### v11.33.5 - 2025-10-02

- :rocket: Require a password on exported TrustStores & Certs

### v11.33.4 - 2025-10-01

- :bug: Modify OpenSSL Commands for Truststore

### v11.33.3 - 2025-10-01

- :bug: Fix call to generate TrustStore p12 file

### v11.33.2 - 2025-10-01

- :bug: Fix call to generate TrustStore p12 file

### v11.33.1 - 2025-10-01

- :rocket: Cleaner Admin Imports Menu

### v11.33.0 - 2025-10-01

- :tada: Support Cursor-On-Target Line Styles
- :rocket: Allow downloading truststore on External Connections
- :bug: Allow including CA chain when PATCHing a connection

### v11.32.0 - 2025-10-01

- :rocket: `UI` Use Network icon to show External Connections vs Paused Cloud Connections
- :tada: Allow downloading the generated TrustStore

### v11.31.0 - 2025-09-30

- :rocket: Fix serious issue with management of user features - Closes: #664
- :tada: Add the ability to recover deleted Archived Features

### v11.30.0 - 2025-09-29

- :rocket: Adds debounce to CoT Remarks & name updates to avoid Mission/API updates on each character change
- :tada: Moves CoTs to mission instead of Copy in ShareToMission component
- :bug: Hides the scrollbar to prevent mini icons in side menu in Chromium based browsers

### v11.29.0 - 2025-09-29

> [!WARNING]
> Alternate deploy tools will need to update to use the now consistent `PMTILES_URL`  env var instead of `APIROOT`

- :rocket: Use consistent Env Var names between services

### v11.28.4 - 2025-09-29

- :bug: Ensure Attachment images don't overflow their div

### v11.28.3 - 2025-09-29

- :bug: Filter by Data Package `uid` and `hash` to ensure updated data packages are retried correctly
- :bug: Migrate to Mission Creation POST to ensure  mission  names don't cause issues and follow REST principals more closely
- :bug: Fix JPEG import as attachment UI
- :bug: Don't attempt to PUT mission content if there is no mission content to PUT

### v11.28.2 - 2025-09-29

- :bug: Fix Display of `.jpeg` file extensions in CoT Viewer

### v11.28.1 - 2025-09-29

- :bug: Fix Data Package import by Hash instead of UID

### v11.28.0 - 2025-09-26

- :rocket: Add additional administrative management support for user Imports

### v11.27.4 - 2025-09-24

- :bug: Ensure the UI doesn't throw errors when looking at a CoT if no iconsets are loaded

### v11.27.3 - 2025-09-23

- :bug: When deleting an Iconset, navigate back to Iconsets list instead of 404ing @AdventureSeeker423
- :bug: When uploading an Iconset, don't double parse the resultant JSON @AdventureSeeker423

### v11.27.2 - 2025-09-22

- :bug: Ensure cert & integrationId are set in Create Machine User UI

### v11.27.1 - 2025-09-19

- :bug: PUT Requests to Machine User API wouldn't return CA Chain

### v11.27.0 - 2025-09-19

- :rocket: Use slidedown for Files Menu
- :rocket Add Search Bar for Files Menu
- :rocket: Add Number of Selected Users and/or Channels to Share Modal
- :tada: Add the ability to add a Profile File into a Data Sync

### v11.26.0 - 2025-09-19

- :tada: API To allow deleting one or more Chatrooms
- :tada: API to allow deleting one or more Chats
- :rocket: GroupSelect Vue3 Component to allow actions to be performed on an arbitrary list of components (IE chats & Chatrooms)

### v11.25.0 - 2025-09-18

- :rocket: Return P12 with Full cert chain when using Connection with External Integration

### v11.24.0 - 2025-09-18

- :rocket: Store the CA chain in the database when calling SignCertificate

### v11.23.0 - 2025-09-17

- :rocket: Simplify Data Sync Layer Creation and only allow the creation of Groups (IE Folders) from the UI
- :bug: Fix bug where username containing integer would result in no WebSocket connection
- :bug: Fix MultiSelect on Data Sync CoTs by ensuring `.properties.id` is always populated on new CoTs
- :bug: Fix padding issue in Settings Menu when selecting `type` property

### v11.22.0 - 2025-09-15

- :rocket: Move Data Sync submission to explicitly use the `authored` flag instead of using Pending Queues
- :bug: Fix another recursive Data Sync bug where an EUD editing a feature would result in a loop

### v11.21.0 - 2025-09-15

- :arrow_up: Update Tabler Core
- :rocket: Reset Color Property when switching from `u-d-p` to `a-*`

### v11.20.0 - 2025-09-14

- :tada: Significant Updates to CoT Selection

### v11.19.0 - 2025-09-12

- :arrow_up: Circle Opacity Support

### v11.18.3 - 2025-09-12

- :arrow_up: Update NodeCoT

### v11.18.2 - 2025-09-12

- :arrow_up: Update NodeCoT

### v11.18.1 - 2025-09-11

- :arrow_up: Update NodeCoT

### v11.18.0 - 2025-09-11

- :rocket: Avoid throwing errors and handle gracefully Connection Creation in a non-COTAK context

### v11.17.2 - 2025-09-11

- :rocket: Migrate Vue3 Components to Composition API

### v11.17.1 - 2025-09-11

- :bug: Fix Click Feature Types

### v11.17.0 - 2025-09-11

- :tada: Allow specifying Query or QueryTopFeatures in ArcGIS ETls

### v11.16.0 - 2025-09-11

- :tada: Allow exporting a Mission Sync as GeoJSON or KML

### v11.15.3 - 2025-09-11

- :rocket: Add rounding to Polygon Area Component

### v11.15.2 - 2025-09-11

- :bug: Ensure all propertes are present for "Multi" Select modal to show contact group

### v11.15.1 - 2025-09-11

- :rocket: Alphabetical order of Basemaps

### v11.15.0 - 2025-09-10

- :rocket: Rename Lost Person Behavior to "Range Rings"
- :bug: Fix distance calculation bug when distance unit was changed
- :tada: Allow adding any number of range rings
- :rocket: Remove Lost Person behavior hardcoded % names

### v11.14.1 - 2025-09-10

- :rocket: Hide self in Contacts List

### v11.14.0 - 2025-09-10

- :rocket: Expands the type query parameter to allow querying for multiple types in a single query
- :rocket: Only queries for raster and vector in basemap UI

### v11.13.3 - 2025-09-10

- :bug: Fix Snapping Coordinate Validity Check

### v11.13.2 - 2025-09-10

- :rocket: Migrate to RDS Graviton Instances

### v11.13.1 - 2025-09-08

- :tada: Allow specifing Cpu/Mem in Parameters to allow rightsizing of staging infra

### v11.13.0 - 2025-09-08

- :tada: Allow specifying Groups when Data Packages are created or Uploaded
- :rocket: Unified Data Package creation modal
- :tada: Allow specifying Hashtags when Data Packages are created or Uploaded

### v11.12.2 - 2025-09-08

- :bug: Remove revoked npm packages

### v11.12.1 - 2025-09-08

- :bug: Fix issue where adding features to Data Sync could end up in a recursive addition loop

### v11.12.0 - 2025-09-08

- :tada: Allow renaming Profile Files

### v11.11.4 - 2025-09-08

- :rocket: Add header to Range & Bearing to allow it to be closed

### v11.11.3 - 2025-09-08

- :tada: Show currently selected basemap in Basemap Menu

### v11.11.2 - 2025-09-08

- :bug: Fix course indicator on CoT style

### v11.11.1 - 2025-09-08

- :bug: Ensure Search provider failures don't prevent server startup
- :bug: Relax Type Check on AGOL OAuth responses

### v11.11.0 - 2025-09-06

- :bug: Fix bug where geometry editing was broken for features in Data Syncs
- :bug: Fix bug where edited geometries wouldn't be saved back to Data Sync

### v11.10.0 - 2025-09-05

- :rocket: Add initial state loading to Video Wall

### v11.9.1 - 2025-09-05

- :arrow_up: Update Core Deploy Dependencies

### v11.9.0 - 2025-09-05

- :tada: Allow Importing GeoJSON from Overlay which support QUERY action via Lasso Tool
- :rocket: Import Basemap Features via the unified GeoJSONInput component

### v11.8.1 - 2025-09-05

- :bug: Fix Sort/Order in Admin Connection UI

### v11.8.0 - 2025-09-05

- :tada: Rewrite to routing and search interface to support pluggable search providers
- :rocket: OpenMeteo weather fallback outside of CONUS
- :rocket: Support for Provider Selection in Routing Interface
- :rocket: Support for Route Mode in Routing Interface
- :rocket: Human Readable Route Callsigns

### v11.7.0 - 2025-09-04

- :bug: Version Sync

### v11.6.0 - 2025-09-04

- :bug: Fix critical Map Rendering Bug

### v11.5.0 - 2025-09-03

- :tada: Move Alarms to top level Layer Object
- :rocket: Add UI for visualizing alarm settings and make High Urgency alarms clearer

### v11.4.0 - 2025-09-02

- :bug: `UI` Use consistent Integer Hash for tiled features
- :bug: `UI` Consistently use `feat.properties.id` where present

### v11.3.0 - 2025-09-02

- :bug: Wire up the Impersonation feature in the Imports API
- :bug: Fix recursion bug where deleting a CoT from a Mission would result in a Change Task which would then make an API call to delete the CoT from the mission, etc, etc, etc.

### v11.2.4 - 2025-09-02

- :rocket: Mirror 256mb Layer Default from DB to API Schema

### v11.2.3 - 2025-09-02

- :rocket: Move to a more intuitive icon for 3d

### v11.2.2 - 2025-09-02

- :rocket: Always surface Video Lease & Video Stream Creation buttons

### v11.2.1 - 2025-09-02

- :rocket: Add text to Video Menu Mode Selector Buttons

### v11.2.0 - 2025-09-02

- :rocket: Use centralized S3 Client generator for Docker Context

### v11.1.1 - 2025-09-01

- :rocket: Fix cursor management when ending draw mode

### v11.1.0 - 2025-09-01

- :rocket: Allow user to select icon rotation preferences

### v11.0.2 - 2025-08-31

- :bug: Lowercase Comparison in v11 migration script

### v11.0.1 - 2025-08-31

- :rocket: Pass the host url as a fn param in the v11 migration script

### v11.0.0 - 2025-08-31

Note: The v11.0.0 migration script must be run after deploying and the resultant migration.sql file applied to the database

- :tada: Entirely rewrite Events Manager to be a server service that handles file conversion of all file types via polling
- :rocket: Remove unused `auto_transform` options from Connection Data Syncs
- :tada: Migrate Profile File storage to be managed in the database and reference an S3 object by UUID
- :rocket: Add Role Admin indicators to Main Menu

### v10.51.2 - 2025-08-27

- :arrow_up Update node-tak

### v10.51.1 - 2025-08-27

- :arrow_up Update node-tak

### v10.51.0 - 2025-08-24

- :bug: Always report SA location to TAK Server to ensure inclusion in contacts list
- :rocket: Add altitude tracking to SA location updates
- :bug: Fix GPS Accuracy tag on SA location updates

### v10.50.0 - 2025-08-22

- :rocket: DEPLOY NOTE: API_URL env vars must now be valid URLs, not just the hostname
- :rocket: NGINX Configuration in HTTP environments

### v10.49.0 - 2025-08-22

- :rocket: Enhanced Location Handling with Manual Override

### v10.48.0 - 2025-08-20

- :rocket: Add addition UI Area Units

### v10.47.1 - 2025-08-19

- :bug: Fix manual sharing of MapLibre Icon URLs

### v10.47.0 - 2025-08-19

- :rocket: Reset Color Property when assigning an icon so that the icon is uncoloured by default.
- :rocket: Set primary color to green if dropping a `u-d-p` or white/uncoloured if dropped an `a-*` CoT type so ATAK doesn't try to recolour the icon.

### v10.46.0 - 2025-08-19

- :rocket: Hide Raster-Dem in basemap list
- :tada: Add scale bar w/ custom styling
- :rocket: Add basic attribtion support

### v10.45.2 - 2025-08-19

- :bug: Fix Iconset Download Bug

### v10.45.1 - 2025-08-12

- :rocket: Update StatusDot for Admin Users to be in dark mode

### v10.45.0 - 2025-08-12

- :rocket: Rewrite Share pane as a Modal for more consistent UI
- :tada: Add the ability to share COTs to all users in a given channel
- :bug: iTAK doesn't support DNS based FileShare - as such lookup the IP address of the FileShare server

### v10.44.1 - 2025-08-11

- :bug: Truncate Sink MessageGroupID to 128 characters

### v10.44.0 - 2025-08-11

- :tada: Per user request add "Feet" and "Yard" units to Distance & Line Length Components
- :rocket: Inline error in Admin Video Service manager if an external media server hasn't yet been integrated
- :bug: Fix sort types in VideoLease list as they were using the Token keys

### v10.43.0 - 2025-08-11

- :rocket: Allow selecting a given target layer for the Lasso Tool

### v10.42.0 - 2025-08-11

- :rocket: Improve performance of JIT Vector Tile generation

### v10.41.0 - 2025-08-10

- :tada: REQUIRES Media-Infra v5.0.0
- :tada: Allow manually setting `proxy` source when configuring a Video Lease
- :rocket: Cleaner Admin Video Service UI

### v10.40.0 - 2025-08-10

- :tada: REQUIRES Media-Infra v5.0.0

### v10.39.0 - 2025-08-08

- :tada: Implement FFMPEG `runOnDemand` function when using MediaMTX in Proxy Mode
- :rocket: Navigate to uploaded Data Package when upload completes instead of the List View
- :rocket: Show the Proxy URL in the Video Lease Modal if in proxy mode
- :rocket: Allow setting the Proxy URL in the Video Lease Modal
- :rocket: Add Cancel button when in editing mode in Video Lease Modal

### v10.38.1 - 2025-08-08

- :rocket: Pass through CacheControl headers for Tiles

### v10.38.0 - 2025-08-08

- :tada: Automatically colour icons with their associated marker-color property if present

### v10.37.0 - 2025-08-07

- :tada: Add the ability to create Routes via the new directions API
- :bug: Attachments would be added but not immediately shown, now they are!
- :rocket: Add input validation to Admin Config page
- :rocket: Some minor DRY improvements to the codebase

### v10.36.1 - 2025-08-04

- :rocket: Increase default point size to match Iconset Size (@chriselsen)

### v10.36.0 - 2025-08-04

- :rocket: Resiliency improvements to the Floating Video Player (@chriselsen)

### v10.35.1 - 2025-08-04 - :tada: @chriselsen

- :bug: Fix White Card Background

### v10.35.0 - 2025-07-14

- :rocket: Finally get `/docs` working as expected

### v10.34.0 - 2025-07-14

- :rocket: Allow deleting all features from profile

### v10.33.1 - 2025-07-14

- :rocket: Disable `Make Active` if WRITE permissions are not present

### v10.33.0 - 2025-07-14

- :rocket: Implement Folder Deletion Ops in My Features Pane
- :bug: Fix styling on some normalized GeoJSON features

### v10.32.1 - 2025-07-14

- :rocket: Truncate coordinates used for snapping

### v10.32.0 - 2025-07-14

- :rocket: Use Vue3 Teleport for modals to fix a couple bugs where modals weren't taking over the full page and instead being crammed inside a small div
- :rocket: Move Theme state to HTML element for better thematic support throughout the app
- :rocket: Make `hover` generic based on theme, replacing hardcoded `hover-dark` and `hover-light`
- :rocket: Remove instances of `bg-white` and let the theme do it's magic

### v10.31.0 - 2025-07-13

- :tada: Support importing arbitrary GeoJSON files

### v10.30.0 - 2025-07-12

- :tada: Support the Data Sync QR Code

### v10.29.0 - 2025-07-12

- :tada: Add new unified Data Package Creation Modal
- :tada: Allow creating Data Packages from user file uploads
- :bug: Fix bug where Mission CoTs weren't properly obtained when creating a Data Package from a Mission
- :rocket: Update SelectFeatures to use new unified Data Package creator

### v10.28.0 - 2025-07-12

- :tada: Respect Mission Context and when in an active mission automatically add new CoTs to the mission
- :rocket: Introduce `render` function to handle all map refresh requests in a single unified interface
- :bug: Mission Syncs were not always getting refreshed when a subscription was dirty

### v10.27.0 - 2025-07-11

- :rocket: Add HandleBar Slice functionality

### v10.26.1 - 2025-07-11

- :bug: Fix source layer removal

### v10.26.0 - 2025-07-11

- :tada: Add new option for Server Admins to set the default units for new users

### v10.25.0 - 2025-07-11

- :tada: Support updating the proxy source for a Video Lease

### v10.24.0 - 2025-07-11

- :tada: Remove single video server deploy options. This would typically be a major release but this feature hasn't been used by anyone other than COTAK and has been retired for > 1 year

### v10.23.0 - 2025-07-11

- :rocket: Allow specifying `tilesize` in Basemaps to ensure MapLibre uses the correct tile size for raster layers
- :rocket: Allow specifying `attribution` in Basemap and import the field from TileJSON if present
- :bug: Add `raster-dem` option on the Admin Basemap management editor

### v10.22.1 - 2025-07-10 - :tada: @chriselsen

- :rocket: Improve Docker efficency & size and allow for custom CloudTAK Data path

### v10.22.0 - 2025-07-09

- :rocket: Pregenerate and store spritesheets alongside the Iconset in the database

### v10.21.1 - 2025-07-07

- :bug: Update MissionSync response schema due to 4xx schema errors seen in the field

### v10.21.0 - 2025-07-07

- :bug: Alarms were only being wired to SNS on incoming layers

### v10.20.1 - 2025-07-07 - :tada: @chriselsen

- :bug: Fix HREF for CloudTAK Logo if no Brand Logo is set

### v10.20.0 - 2025-07-07

- :arrow_up: Update Batch-Alarms to ensure CloudWatch dashboards links remain clickable

### v10.19.0 - 2025-07-03

- :rocket: Migrate DrawTools to it's own component to clean up Map.vue
- :tada: Introduce initial Lost Person Input for generating range rings
- :rocket: Optimize style by not rendering polygon interiors if fill-opacity = 0
- :rocket: Optimuze label placement by rendering Polygon labels with fill-opacity = 0 as line labels

### v10.18.0 - 2025-07-03

- :rocket: Support `emergency` section on CoT type
- :bug: Attempt to fix HLS issue in chrome - Ref: https://github.com/video-dev/hls.js/issues/737

### v10.17.0 - 2025-07-03

- :rocket: Allow ECR repositories to be configured via Env Vars

### v10.16.0 - 2025-07-02

- :rocket: Add Layer Schema support for `number` and `integer`
- :rocket: Add default application support for `number` and `integer`

### v10.15.0 - 2025-07-02

- :rocket: Move Layer Invoke button to incoming config where it applied
- :rocket: Allow downloading a Layer Config file

### v10.14.0 - 2025-07-01

- :rocket: Return 404 on tiles outside of TileJSON bounds

### v10.13.0 - 2025-07-01

- :rocket: Migrate to Vue Page for Docs & update OpenAPI Defs

### v10.12.0 - 2025-06-30

- :rocket: Attempt to determine delimiter type in CSV Import

### v10.11.0 - 2025-06-30

- :rocket: Include OpenAPI Prefix & Security Document

### v10.10.0 - 2025-06-27

- :rocket: Explicitly set `archived: true` on CoTs added to Mission Sync
- :arrow_up: Update batch-generic to throw 4xx errors for unqiue constraint violations
- :rocket: Minor labelling improvements to style editor

### v10.9.0 - 2025-06-26

- :rocket: Allow Main CloudTAK Menu to be resizable

### v10.8.0 - 2025-06-26

- :arrow_up: Update node-cot@13

### v10.7.0 - 2025-06-24

- :bug: Ensure Connection Video Lease deletions are limited to scope of the connection
- :rocket: Add search box for items in all Connection Panes

### v10.6.0 - 2025-06-24

- :rocket: Start to sketch out Admin Layers UI
- :bug: Fix returned lease on password rotate
- :rocket: Migrate Admin Layers List to TS

### v10.5.0 - 2025-06-21

- :rocket: Allow adding a logo to an ETL Task
- :rocket: Allow adding a favorite to an ETL Task
- :rocket: Redesign Task Selection UI to be more visual
- :rocket: Make Initial Author in Admin Footers look a little nicer

### v10.4.0 - 2025-06-20

- :rocket: Provide UI for uploading a Server Logo

### v10.3.0 - 2025-06-20

- :rocket: Notification support for CASEVACs
- :rocket: Notification support for Alerts
- :tada: ReadOnly connections to support external integrations

### v10.2.2 - 2025-06-18

- :rocket: Reduce logging for known WebSocket Errors

### v10.2.1 - 2025-06-17

- :rocket: Update Web Types

### v10.2.0 - 2025-06-17

- :bug: Fix a bug where CloudFormation Parameters in Layers weren't updating properly
- :bug: Fix a bug where Connection Video Leases didn't get their connection
- :rocket: Automatically infer a `VideoLease.layer` where possible

### v10.1.0 - 2025-06-17

- :tada: Include Route53 Domain in CloudFormation Template -- Note you will have to delete Route53 Domains before deploying this version so they are controlled by IaC

### v10.0.1 - 2025-06-13

- :bug: Need to investigate root casue further but somehow a CloudFormation `ref` worked on CloudFormation template update despite being null but not on a fresh deployment

### v10.0.0 - 2025-06-12

- :rocket: Migrate to VPC 2.0
- This will require significant devops work to migrate without downtime - contact nicholas.ingalls@state.co.us to discuss steps

### v9.4.2 - 2025-06-12

- :rocket: Include Sensor Type & Model in Sidebar

### v9.4.1 - 2025-06-11

- :bug: Remove Debug call to COTAK resource
- :bug: Add `token` query param to Connection Assets

### v9.4.0 - 2025-06-11

- :tada: Introduces UI to add outgoing COT Filters - Closes: https://github.com/dfpc-coe/CloudTAK/issues/671
- :rocket: Add ability to include a Content-Dispo on Connection Assets

### v9.3.0 - 2025-06-10

- :tada: Add support for Public Tilesets
- :rocket: Allow for changin between Vector and Raster basemaps

### v9.2.0 - 2025-06-09

- :tada: Support for "Cutting" features from an external GIS system into COT Markers

### v9.1.0 - 2025-06-06

- :rocket: Consistent Title bars for COT Properties

### v9.0.0 - 2025-06-06

- :rocket: Remove Layer Template table in favour of reimplementation via existing Layer Table so they stay in sync
- :tada: Add preliminary support for 2525D MilSym Icons
- :rocket: Show readonly Unit Status in CoT sidebar if present via MilSym tag
- :rocket: Show readonly GeoFence information in shared Geofences

### v8.45.2 - 2025-06-05

- :bug: Add scoped CSS For Status Style as it was breaking animated status elsewhere in the app

### v8.45.1 - 2025-06-05

- :bug: Fix bug which prevents new layer creation

### v8.45.0 - 2025-06-04

- :rocket: Registered Task Definitions can now be deleted
- :rocket: Remove GroupSelectModal as it is no longer used
- :rocket: Use GroupSelect for Data Sync Creation
- :rocket: Create LayerTaskSelect for ETL Task selection and don't use modal in new Layer Creation flow
- :rocket: Migrate a few Admin/Layer components to Vue Setup as a pre-req to converting them to TS.

### v8.44.0 - 2025-06-03

- :bug: Fix Iconset Menu auth checks
- :rocket: Slightly nicer Icon Select Dropdown

### v8.43.1 - 2025-06-03

- :bug: Fix location of UAS tool wizard button

### v8.43.0 - 2025-06-03

- :rocket: Add GOTO Home Logo
- :rocket: Continue to iterate on merging of data and events codebase
- :rocket: Automatically add archived tags to routes
- :bug: Fix double tooltip
- :bug: Remove a bunch of console.error calls
- :bug: Fix time calc for breadcrumb loading

### v8.42.0 - 2025-05-31

- :rocket: Remove unused Public Bucket **Note** You will need to empty the bucket before deploying

### v8.41.0 - 2025-05-30

- :tada: Begin to sketch out Mission Mode include wiring up `Make Active` Mission Button
- :rocket: Move around zoom buttons to make room for Active Mission Mode
- :tada: Allow server admins to specify default map mode

### v8.40.0 - 2025-05-30

- :tada: Add pitch reset icon to Map view

### v8.39.0 - 2025-05-30

- :tada: Initial Range & Bearing support

### v8.38.0 - 2025-05-29

- :rocket: Improvements to plain text output of HTML Strip function in handlebar templates
- :rocket: Calculate stale value from current time if not explicitly set

### v8.37.0 - 2025-05-27

- :tada: Allow stripping HTML in template defs

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

