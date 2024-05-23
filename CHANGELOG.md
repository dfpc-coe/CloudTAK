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

