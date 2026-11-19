# Publishing TAK-NZ CloudTAK as iOS and Android Apps

How to turn the Capacitor projects already in `app/android/` and `app/ios/` into
our own store apps under the ID `nz.tak.app`.

Upstream ([dfpc-coe/CloudTAK](https://github.com/dfpc-coe/CloudTAK)) publishes
CloudTAK as `io.cloudtak.app`. The native projects in this repo are copies of
upstream's, unchanged. No other upstream repo holds mobile code. The `dfpc-coe`
org has no mobile, signing or store-release repository, and upstream's `main`
has no mobile build workflow.

**Status:** plan only. Nothing in this document has been applied or built.

Just want an Android APK for your own testing? Go to the quick start below.

---

## Quick start: Android test APK only

For internal testing on your own devices, a debug APK needs far less than the
full plan below.

**Skip for now:** developer accounts, store listings, a release keystore
(Gradle signs debug builds with its auto-generated debug key), Firebase
(`build.gradle` applies the Google Services plugin only if `google-services.json`
exists), all iOS work, and CI.

**Needed:**

- Node, a JDK and the Android SDK. Set `ANDROID_HOME`, or add `sdk.dir` to
  `app/android/local.properties`.
- The server URL at first run. The setup screen has a manual URL entry, so
  `PROVIDER_REGISTRY_URL` doesn't have to change. The provider list it shows is
  upstream's.

**Build (one command):** `scripts/build-android-debug.sh` does everything below, including
the plugin-copy workaround, and prints the APK path. The manual steps are:

**Build:**

```bash
cd app
npm ci
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
# output: app/android/app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

You can also copy the APK to a phone and open it. Allow installs from unknown
sources first.

**Gotchas found in the first build:**

- A JRE is not enough. Gradle needs a full JDK 21 (with `javac`). A portable
  Temurin JDK unpacked in `~/jdk` works without `sudo`: set `JAVA_HOME` to it and
  pass `-Dorg.gradle.java.installations.paths=$JAVA_HOME` to `./gradlew`.
- Web plugins (`app/plugins/`) are baked into the bundled web app. If they are
  symlinks to sibling repos (as in a local dev setup), `npm run build` fails,
  because the plugins import `../../src/...` relative to their real path. Build
  with real copies, the way the Dockerfile does through `api/bin/plugin.ts`.
  Plugins missing from the build are also missing from the app.
- Run `branding/generate_native_icons.sh` to regenerate the native icons, splash
  screens and in-app logo from `branding/logo/tak-nz-logo.svg`.

**Optional for a first test:**

- **App ID.** Leaving `io.cloudtak.app` works, but it conflicts with upstream's
  CloudTAK if that is installed on the same phone. Changing it to `nz.tak.app`
  takes three Android edits: `android/app/build.gradle`, `MainActivity.java`
  (moved to the new package folder) and `strings.xml` (section 3). Also change the
  app name so the two apps can sit side by side. If you change the ID in the
  native files, change `capacitor.config.json` as well so they stay consistent.
- **Icons.** Upstream's can stay for a first test.
- **Release build.** `assembleRelease` produces an unsigned APK that won't
  install until signed. Use debug for testing.

**What a debug APK doesn't test:**

- Push notifications (no Firebase config).
- OTA updates (the updater plugin does nothing useful under a new app ID).
- Background location behaviour. It is indicative only, because Android can treat
  debuggable builds differently.

**iOS** has no equivalent shortcut. An on-device test build needs a Mac, Xcode and
an Apple ID. A free Apple ID gives 7-day provisioning. Practical team testing
goes through TestFlight, which needs the paid account.

When the test build works, continue with the full plan below.

---

## 1. Decisions needed first

| Decision | Notes |
|---|---|
| App ID | `nz.tak.app` (assumed here) |
| Store display name | Used in `strings.xml`, `Info.plist`, store listings. Set to `TAK.NZ` |
| Associated domain | A domain we control, for iOS `webcredentials:` (password and passkey autofill). Placeholder: `tak.nz` |
| Server selection in the app | See section 5. Registry list, fixed server, or manual URL |
| Push notifications | Whether to ship them in v1. Needs Firebase and an APNs key |
| OTA updates | Keep, remove or self-host `@capgo/capacitor-updater`. See section 8 |
| Publisher identity | Individual or organisation accounts. Organisation iOS accounts need a D-U-N-S number and take longer to approve |

---

## 2. Accounts and credentials (outside the repo)

| Item | Where | Notes |
|---|---|---|
| Apple Developer Program | developer.apple.com | Annual fee. Needed for TestFlight and App Store |
| Google Play Console | play.google.com/console | One-off fee. New personal accounts must run a closed test (12 testers for 14 days) before production access |
| Firebase project | console.firebase.google.com | Register an Android app and an iOS app, both as `nz.tak.app` |
| APNs auth key (`.p8`) | Apple Developer > Keys | Upload to Firebase for iOS push |
| Android upload keystore | Generate locally | Back it up. Enrol in Play App Signing |
| Apple App ID | Apple Developer > Identifiers | Create `nz.tak.app` with the capabilities in section 4 |

Never commit keystores, `.p8` files, `google-services.json`, or
`GoogleService-Info.plist` with real values. `google-services.json` is already
gitignored. Store these as GitHub Actions secrets or in a vault.

---

## 3. Rename the app ID

All edits are under `app/`. Search for leftovers afterwards with:

```bash
grep -rIn -E 'io\.cloudtak|io/cloudtak|cloudtak\.io' app \
  --exclude-dir=node_modules --exclude-dir=dist --exclude=package-lock.json
```

| File | Change |
|---|---|
| `capacitor.config.json` | `appId` and `plugins.CapacitorUpdater.appId` to `nz.tak.app`. Change `appName` to the display name |
| `android/app/build.gradle` | `namespace` and `applicationId` to `nz.tak.app` |
| `android/app/src/main/java/io/cloudtak/app/MainActivity.java` | Change `package` to `nz.tak.app` and move the file to `.../java/nz/tak/app/` (`git mv`) |
| `android/app/src/main/res/values/strings.xml` | `app_name`, `title_activity_main`, `package_name`, `custom_url_scheme` |
| `ios/App/App.xcodeproj/project.pbxproj` | `PRODUCT_BUNDLE_IDENTIFIER` (Debug and Release). Set `DEVELOPMENT_TEAM` to our team ID (upstream's is `TM6L5H72UM`) |
| `ios/App/App/Info.plist` | `CFBundleDisplayName`. Review the usage-description strings (camera, FaceID, location) and reword for TAK-NZ |
| `ios/App/App/App.entitlements` | Replace `webcredentials:cloudtak.io` with `webcredentials:<our domain>` |

Also review the unit-test placeholder packages `com/getcapacitor/myapp/`. They are
template leftovers and don't affect the build.

After editing, run `cd app && npm install && npm run build && npx cap sync` and
confirm both native projects open and build.

### Versioning

Upstream bumps these on every release, which means merge conflicts on each sync:

- Android: `versionCode` and `versionName` in `android/app/build.gradle`
  (currently `13124000` / `13.124.0`)
- iOS: `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` in `project.pbxproj`
  (currently `13.124.0` / `50`)

Stores require `versionCode` and `CURRENT_PROJECT_VERSION` to rise on every
upload. Decide on a scheme. For example, keep upstream's version as the marketing
version and add our own build number, set by CI at build time through Gradle
properties and `xcodebuild` build settings. That avoids hand edits to the files
upstream also edits.

---

## 4. iOS entitlements and capabilities

`App.entitlements` carries upstream's capabilities. Keep only what we need and
enable the same ones on our Apple App ID.

| Entitlement | Needed for | Action |
|---|---|---|
| `aps-environment` | Push notifications | Keep if shipping push. Enable Push Notifications on the App ID |
| `com.apple.developer.associated-domains` | Passkey and password autofill | Change the domain. Host `/.well-known/apple-app-site-association` on it |
| `com.apple.developer.location.push` | Location push | Requires Apple approval. Remove if not needed |
| `carrier-constrained.*` and `networking.slicing.*` | Satellite and 5G slicing optimisation | Specialised. Some need Apple approval. Remove for v1 unless wanted |

Unapproved restricted entitlements cause signing and provisioning failures, so
trimming them is the safest first step.

`Info.plist` already declares `UIBackgroundModes` of `location` and
`remote-notification`. Apple review expects a clear reason for background
location. Prepare one for the review notes.

---

## 5. Server selection (provider registry)

The first-run screen lists the servers a user can connect to, with manual URL entry
as the alternative. The list comes from <https://app.tak.nz/v1/servers.json>
(repository [TAK-NZ/app.tak.nz](https://github.com/TAK-NZ/app.tak.nz), published with
GitHub Pages), which replaces upstream's `api.cloudtak.io`. To add or change a server,
edit `servers.json` in that repository.

`app/src/components/Setup/providers.ts` resolves the list so that the screen is never
left without choices:

1. the registry, if it answers with at least one valid server (and the answer is saved)
2. the last list that was saved on the device
3. the servers built into the app (`BUNDLED_PROVIDERS`; keep it in step with `servers.json`)

When it falls back, the screen says so and offers "Try again". Registry entries are
untrusted: whoever can edit the registry decides where users sign in, so only plain
`https` hosts are accepted (no `http://`, paths or userinfo), and logos must be small
PNG, JPEG or WebP images.

The old plan of hosting this on `tak.nz` or hiding the list is not needed: manual entry
still works for any server.

---

## 6. Branding

### What exists today

Only `branding/logo/tak-nz-logo.svg` (the kiwi shield) and
`app/public/favicon.ico` are TAK-NZ. Everything else is upstream's:

| Asset | Current content |
|---|---|
| `app/public/logos/**` (web and PWA PNGs, `apple-touch-icon`) | COTAK shield (old upstream icons). `branding/generate_icons.sh` would overwrite them from the SVG, but they appear never to have been regenerated |
| `app/public/CloudTAKLogo.svg`, `CloudTAKLogoText.svg`, `logo.png` | Yellow CloudTAK cloud and wordmark, and the COTAK shield. Identical to upstream |
| Android `mipmap-*` launcher icons | Yellow cloud on a teal gradient |
| iOS `AppIcon-1024.png` and `CloudTAK.icon` | Yellow cloud on dark navy or black |
| Android and iOS splash screens | Capacitor's default blue mark on white. Upstream never branded them |

### Decisions

- **Logo:** the kiwi shield from `branding/logo/tak-nz-logo.svg`, used for the native
  icons, the splash screens and the in-app `CloudTAKLogo.svg`.
- **Colours** (taken from tak.nz's stylesheet): dark blue `#003366` as the icon
  background and primary colour, `#002244` as the darker shade (site footer and
  header border), `#004499` as the accent, plus black and white. Re-check these
  against any official brand guide.

### Android (`app/android/app/src/main/res/`)

| File | Action |
|---|---|
| `mipmap-*/ic_launcher_foreground.png` (108, 162, 216, 324, 432 px) | Shield on a transparent background, kept inside the central ~60% (Android's safe zone) so masks don't clip it |
| `drawable/ic_launcher_background.xml` | Replace upstream's teal gradient with a solid `#003366` |
| `mipmap-*/ic_launcher_monochrome.png` (same sizes) | Single-colour silhouette on transparency (Android 13+ themed icon). Check by eye, because the shield has black and white parts |
| `mipmap-*/ic_launcher.png`, `ic_launcher_round.png` (48 to 192 px) | Legacy icons for old Android versions. Regenerate for consistency. Check `minSdk` in `variables.gradle` to see if they are ever shown |
| `drawable/splash.png` and `drawable-{port,land}-*/splash.png` | Logo centred on a plain `#003366` or white background |
| `drawable-v24/ic_launcher_foreground.xml` | Unused leftover from the Capacitor template. Leave it |

### iOS (`app/ios/App/App/`)

| File | Action |
|---|---|
| `Assets.xcassets/CloudTAK.appiconset/AppIcon-1024.png` | Shield on a solid `#003366` background, flattened to RGB. Apple rejects icons with transparency |
| `CloudTAK.icon/Assets/CloudTAK Icon Color.svg` and `icon.json` | Replace the SVG. `icon.json` applies a yellow-orange gradient `fill` to the layer, and that would tint the whole shield. Remove the layer's `fill`, and set the icon background to `#003366`. Edit in Icon Composer (Xcode 26 or later) |
| `Assets.xcassets/Splash.imageset/splash-2732x2732*.png` (three identical files) | Logo small and centred. `LaunchScreen.storyboard` stretches the image to fill the screen over a white background, so use a white or matching background |

`ASSETCATALOG_COMPILER_APPICON_NAME` is `CloudTAK`, so keep the `CloudTAK` names
for both the `.appiconset` and the `.icon`.

### In-app logos (`app/public/`)

- Replace `CloudTAKLogo.svg` with the kiwi shield. The mobile setup screen
  (`Setup/App.vue`) loads it before a server is chosen, so a server-side
  `login::logo` setting cannot override it. `Loading.vue`, `MapLoading.vue`,
  `ServerStatus.vue`, `NavHeader.vue` and `Login.vue` use it as the default.
- `CloudTAKLogoText.svg` is a "CloudTAK" wordmark (used by `Login.vue` and
  `Configure.vue`). It needs a TAK-NZ wordmark version. Leave it for the first test
  build.
- `logo.png` still shows the COTAK shield. Replace it.
- Regenerate `app/public/logos/**` with `branding/generate_icons.sh`. This
  affects the web and PWA icons, not the native app.
- These are upstream files, so the replacements will conflict if upstream changes
  them. Record them in `FORK-DELTA.md`.

### How to produce the files

1. Use `branding/logo/tak-nz-logo.svg` as the single source.
2. Add a script, `branding/generate_native_icons.sh`, next to
   `generate_icons.sh`. It uses `rsvg-convert` and ImageMagick (the same tools
   as `generate_icons.sh`) to render the files above into the existing paths with
   the existing file names, so no config needs to change. Rerun it after upstream
   syncs.
3. Don't use `@capacitor/assets` for iOS. Unverified, but I believe it writes to
   an `AppIcon.appiconset` and would not replace our `CloudTAK.appiconset`.

Colours and theme: also check `styles.xml` and the `StatusBar` block in
`capacitor.config.json` (`style: DARK`, `overlaysWebView: true`).

---

### SSO inside the app

The web SSO flow (navigate to `/api/login/oidc`, land back on `/login#sso=...`)
cannot work inside the app: the bundled app and the server are different origins.
The app instead runs the login in the system browser and gets control back
through its URL scheme.

1. `app/src/utils/native-sso.ts` creates a random verifier, sends only its SHA-256
   (`app_challenge`) to `GET /api/login/oidc`, and opens the page with
   `@capacitor/browser`.
2. After the IdP login, `GET /api/login/oidc/callback` returns to
   `nz.tak.app://login?code=...` (a small HTML page with a link, because browsers
   differ on following a bare redirect to a custom scheme). Failures return the same
   way as `?sso_error=...`.
3. The app redeems the code at `POST /api/login/oidc/exchange` with the verifier.
   Any app can claim a custom URL scheme, so the URL carries only a 2-minute code
   that is useless without the verifier, never a session.

No IdP change is needed: the redirect URI is still the server's callback. The
scheme comes from `MOBILE_APP_SCHEME` on the server (default `nz.tak.app`) and must
match the Android `custom_url_scheme` string and the iOS `CFBundleURLSchemes`.
Logout in the app opens `/api/logout` in the browser (to end the IdP session) and
returns to `/login?signed_out=1`, which stops forced SSO from signing straight back in.

### Pause / Resume sharing

Native app only (the web app is unchanged). "Paused" means the user chose to be
offline: nothing about them leaves the device and nothing reaches them until they
tap Resume. There is deliberately no timer and no auto-resume.

While paused the app:

- closes the TAK server connection and stops broadcasting the self position
  (`Atlas.pauseSharing()` in `workers/atlas.ts`; a paused `AtlasConnection.connect()`
  is a no-op, so no code path can reconnect it)
- stops the location watch, which also removes the Android "location is being used"
  notification
- releases the screen wake lock
- removes this device's push registration, so the server stops sending alerts to it
  (other devices, such as the web app, are unaffected)

The pause is stored on the device (`sharingPausedBy` in Preferences) and survives
restarts and reboots: the app starts paused, without opening a connection, until the
user resumes. It belongs to the user who paused; a different user signing in on the
same device starts live. If a step of pausing fails, the app still counts as paused
and shows the error; it never falls back to live.

Where it shows: a broadcast icon button left of Logout in the main menu footer
(Pause asks for confirmation, Resume does not), a "Live" / "Paused" label under the
username, a grey ring (instead of the green or red dot) on the Home logo, and a
"Paused - Tap to resume" pill above the logo on the map. State lives in
`stores/sharing.ts`.

### Notification icon

Android draws the status-bar icon from its alpha channel only, so the full-colour
launcher icon shows as a blob. `ic_stat_tak` (the kiwi alone, from
`branding/logo/tak-nz-kiwi.svg`) is used for the background-location notification
(`capacitor_background_geolocation_notification_icon` in `strings.xml`) and as the
default push notification icon (`AndroidManifest.xml`).

---

## 7. Push notifications (optional for v1)

The app calls `FirebaseMessaging` from `app/src/stores/device/notification.ts`,
and the server stores per-deployment Firebase credentials under the admin config
keys `notification::push::firebase::*` (project ID, client email, private key).

Setup:

1. In Firebase, add an Android app and an iOS app with ID `nz.tak.app`.
2. Android: put `google-services.json` in `app/android/app/`. `build.gradle`
   applies the Google Services plugin only if this file exists.
3. iOS: add `GoogleService-Info.plist` to the `App` target in Xcode. Upload the
   APNs `.p8` key and its Key ID and Team ID in Firebase > Cloud Messaging.
4. Create a Firebase service account, then in the CloudTAK admin config
   (Notifications section) enable push, choose `firebase`, and paste the project
   ID, client email, and private key.
5. Test on real devices. The iOS simulator cannot receive APNs pushes reliably.

If skipping push for v1, remove the `aps-environment` entitlement and don't
request notification permission, or the review will ask why it's there.

---

## 8. Over-the-air updates (`@capgo/capacitor-updater`)

`capacitor.config.json` enables `CapacitorUpdater` with `autoUpdate:
"atBackground"`, and `app/src/main.ts` calls `notifyAppReady()`. This plugin
swaps the bundled web assets for a newer bundle without a store release.

Not verified: where bundles are fetched from. With the default configuration the
plugin talks to Capgo's cloud, keyed by `appId`. Our `nz.tak.app` would have no
bundles there, so it would simply stay on the shipped build. Pick one:

- **Remove or disable it** for v1. Every web change then goes through store
  review.
- **Use Capgo cloud** or a **self-hosted update server**. Then set up bundle
  upload in CI.

Both stores permit updating web content in a hybrid app, but you must not use it
to change the app's primary purpose. Note that a remote web view over our server
already gets server-side updates whenever we deploy, if the app loads remote
content.

---

## 9. Local build and test

Prerequisites:

- Android: JDK 21 (check `android/variables.gradle` and Capacitor 8 docs for the
  current requirement), Android SDK via Android Studio
- iOS: macOS with a current Xcode (Capacitor 8 uses Swift Package Manager, so
  CocoaPods is not needed)

```bash
cd app
npm install
npm run build
npx cap sync            # copies dist/ and plugin config into both projects
npx cap open android    # Android Studio
npx cap open ios        # Xcode
```

Run on a device or emulator, then check:

- First-run server selection works (section 5).
- Login, including passkey and OIDC, completes.
- Foreground and background location.
- Camera and photo upload.
- Push, if shipped.

Note that `app/package.json` has no `cap` scripts. Consider adding
`"cap:sync": "npm run build && cap sync"`, and the `postinstall`
`patch-package` step already handles the `@capacitor/keyboard` patch.

---

## 10. CI/CD

Existing workflows in `.github/workflows/` cover web, Docker and CDK only. Add
mobile workflows triggered by tags, for example `mobile-v*`, or manually.

**Android** (Ubuntu runner)

1. `actions/setup-node`, `actions/setup-java`, then `npm ci` and `npm run build`
   in `app/`.
2. `npx cap sync android`.
3. Write the keystore and `google-services.json` from secrets.
4. `./gradlew bundleRelease` with signing properties passed in.
5. Upload the `.aab` to Play (internal track) with
   `r0adkll/upload-google-play` and a Play service account.

**iOS** (macOS runner)

1. Same Node steps, then `npx cap sync ios`.
2. Import the distribution certificate and provisioning profile (or use Fastlane
   `match`, or an App Store Connect API key with automatic signing).
3. `xcodebuild archive` and `-exportArchive`, or `fastlane gym`.
4. Upload to TestFlight with `xcrun altool`, `fastlane pilot`, or
   `apple-actions/upload-testflight-build`.

Secrets to define: Android keystore (base64), keystore passwords and alias,
Play service account JSON, Apple certificate (base64) and password, provisioning
profile, App Store Connect API key (ID, issuer, `.p8`), `google-services.json`,
`GoogleService-Info.plist`.

macOS runners are billed at a higher rate than Linux runners, so build iOS on tags
or manual dispatch only.

---

## 11. Store submission

Both stores need:

- App name, short and long description, category, support contact
- Screenshots for the required device sizes (phones, plus iPad for iOS if the app
  supports it)
- A privacy policy URL
- A way for reviewers to log in: a demo account on a reachable server, with
  instructions. This is the most common rejection reason for apps that need a
  server

**Apple:** App Privacy "nutrition labels" (location, contact info, identifiers,
user content), export compliance (`ITSAppUsesNonExemptEncryption` is already
`false`), background-location justification, and TestFlight testing before
submission.

**Google:** Data safety form, location permission declaration (including
background location, which needs a justification and often a short demo video),
target API level compliance, and the closed-testing requirement for new personal
accounts.

---

## 12. Keeping up with upstream

`docs/UPSTREAM-SYNC.md` describes how this fork merges upstream. Mobile files
under `app/android` and `app/ios` fall inside the synced `app/` tree.

- Expect conflicts on version numbers (section 3) and on any file where we changed
  an upstream line.
- Keep our changes small and isolated. Where possible, drive values from build
  settings or config instead of editing upstream lines.
- Record every changed upstream file in `docs/fork/FORK-DELTA.md`.
- After each sync, rerun the `grep` from section 3 to catch anything upstream
  reintroduced, and run `npx cap sync`.

---

## 13. Suggested order of work

1. Decide section 1 items. Create the Apple, Google and Firebase accounts, since
   approval can take days.
2. Rename the ID and branding (sections 3 and 6). Build locally on both
   platforms.
3. Resolve server selection (section 5) and OTA (section 8).
4. Trim iOS entitlements (section 4). Add push if wanted (section 7).
5. Ship internal builds: Play internal testing and TestFlight, by hand.
6. Add CI (section 10).
7. Prepare store listings and submit (section 11).
8. Update `FORK-DELTA.md` and `UPSTREAM-SYNC.md` (section 12).

## Open questions

- What display name and domain do we use?
- Which server-selection option (section 5)?
- Do we ship push and OTA updates in v1?
- Who owns the developer accounts?
- Does the app load the web UI from the bundled `dist/` or from a remote server
  URL? This was not verified and affects section 8.
