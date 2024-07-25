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

