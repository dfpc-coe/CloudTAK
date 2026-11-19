# Apple Developer setup for the TAK.NZ iOS app

How the Apple side of the iOS app was set up, step by step, so it can be repeated: a new Apple account,
a lost API key, a second app, or a new team member. Everything here is done in a web browser. No Mac is needed.

Written 19 November 2026 for the TAK.NZ account. Apple renames menus now and then, so treat the labels as a
guide, and check the linked Apple pages when something does not match.

For what the CI workflows do with this setup, see [MOBILE-APPS.md](MOBILE-APPS.md#ios-builds-and-testflight-without-a-mac).

## What exists when it is finished

| Where | What | Value |
|---|---|---|
| Apple Developer account | App ID (identifier) | `nz.tak.app`, description `TAK NZ`, no capabilities |
| App Store Connect | App record | Name `TAK.NZ`, bundle ID `nz.tak.app`, primary language English (U.K.) |
| App Store Connect | API key | Name `GitHub Actions`, role Admin |
| App Store Connect | TestFlight group | An internal group with automatic distribution on |
| GitHub, TAK-NZ/CloudTAK | Secrets | `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8_BASE64`, `APPLE_TEAM_ID` |
| GitHub, TAK-NZ/CloudTAK | Environment | `ios-testflight`: requires an approval, `main` only |

## Before you start

- An **Apple Developer Program** membership (99 USD a year, or free for an eligible non-profit, see
  [Account type](#account-type-and-moving-later)). Enrolment: <https://developer.apple.com/support/enrollment/>.
- You must sign in as the **Account Holder**. Creating the API key and registering identifiers need it, or an Admin.
- The Apple Account needs two-factor authentication.
- Your **Team ID** is shown under Membership details at <https://developer.apple.com/account>. It is not secret.

## 1. Check the account

1. Sign in at <https://developer.apple.com/account> as the Account Holder.
2. Under Membership details, note the Team ID and check the membership is active.
3. Accept any agreement banner ("Review Agreement"), in the developer account and in App Store Connect. A
   pending agreement blocks uploads. The Paid Applications agreement and banking details are only for paid apps
   and in-app purchases, and are not needed.

## 2. Register the App ID

Certificates, Identifiers & Profiles → Identifiers → **+** → App IDs → App.

- **Description:** `TAK NZ`. This field only accepts letters, numbers and spaces. `TAK.NZ` is rejected with
  "not a valid name for an app id", and the description is only an internal label.
- **Bundle ID:** Explicit, `nz.tak.app`. This is a separate field and keeps its dots.
- **Capabilities:** leave all of them off for the first builds. See [Adding push notifications](#adding-push-notifications)
  and [Associated domains](#associated-domains-later) for turning them on.

The bundle ID can't be changed once a build has been uploaded for the app, so choose it carefully. It is
already set to `nz.tak.app` in `capacitor.config.json` and the Xcode project.

## 3. Create the app in App Store Connect

<https://appstoreconnect.apple.com> → Apps → **+** → New App.

- **Platform:** iOS.
- **Name:** `TAK.NZ`. App names are unique across the whole App Store. If it is taken, use something like
  "TAK.NZ - Team Awareness". The name under the icon on the phone comes from the app (`Info.plist`), not from here.
- **Primary language:** English (U.K.). English (New Zealand) is not offered, and NZ spelling follows British.
  This is only the language of the store listing text. The countries the app is offered in are set separately,
  under the app's Pricing and Availability.
- **Bundle ID:** pick `nz.tak.app` from the list. It only appears after step 2.
- **SKU:** any internal label, for example `taknz-ios`.
- **User access:** Full Access.

## 4. Create the API key

The CI workflow signs and uploads with an App Store Connect API key, so no Mac, certificate file or
provisioning profile is ever handled by hand. Xcode creates and manages Apple's *cloud-managed* certificates
through the key.

App Store Connect → **Users and Access** → **Integrations** → App Store Connect API → **Team Keys**.

1. The first time, the Account Holder has to press **Request Access**.
2. Press **+**, name it `GitHub Actions`, role **Admin**. Apple says managing cloud-managed certificates needs the
   Account Holder or Admin role, so a lower role may not be enough
   (<https://developer.apple.com/help/account/certificates/cloud-managed-certificates/>).
3. **Download the `.p8` file immediately. Apple only lets you download it once.** Copy the **Key ID** from the list and the
   **Issuer ID** from the top of the page.
4. Encode the key for GitHub: `base64 -w0 AuthKey_XXXXXXXX.p8` (on macOS: `base64 -i AuthKey_XXXXXXXX.p8`).
5. Keep the original `.p8` in a password manager. It can't be downloaded again.

An Admin key can create certificates and change the account, so treat it like a password.

## 5. Add the GitHub secrets and the environment

Repository **TAK-NZ/CloudTAK** → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
|---|---|
| `ASC_KEY_ID` | the Key ID from step 4 |
| `ASC_ISSUER_ID` | the Issuer ID from step 4 |
| `ASC_KEY_P8_BASE64` | the base64 text from step 4 |
| `APPLE_TEAM_ID` | the Team ID from step 1 |

**Environment.** The TestFlight job runs in an environment called `ios-testflight`, so it only runs after someone approves it
and only from `main`. Settings → Environments → New environment → `ios-testflight` → tick **Required reviewers**
(add yourself) → Deployment branches and tags → Selected branches → `main`.
The same can be done with the API: `PUT /repos/TAK-NZ/CloudTAK/environments/ios-testflight` with a `reviewers` list and
`deployment_branch_policy.custom_branch_policies: true`, then `POST .../deployment-branch-policies` with `name: main`.

Better: store the four secrets in that environment (Environment secrets) instead of at repository level. At repository
level every workflow in the repo can read them.

## 6. Testers

**You (the Account Holder)** are already an App Store Connect user and need no invitation.

**Other people** are added as users: App Store Connect → **Users and Access** → **People** → **+**. Give first name,
last name and email (it does not have to be an Apple Account yet), a role without access to settings such as
Developer or Marketing, and limit it to this app. The invitation expires after 3 days. An individual account can add up
to 50 such users, and they only get App Store Connect, not team membership
(<https://developer.apple.com/help/app-store-connect/manage-your-team/add-and-edit-users/>).

**The TestFlight group:** Apps → TAK.NZ → TestFlight → **+** next to Internal Testing → name it → tick
**Enable automatic distribution** → open it → **Invite Testers** → tick the people. If someone isn't listed, change
their user role. Up to 100 internal testers, and builds stay available for 90 days
(<https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/>).

**On the iPhone:** install Apple's **TestFlight** app, sign in with the same Apple Account, and install TAK.NZ when a
build appears. Internal testing needs no Apple review.

**External testers** (people who are not App Store Connect users, or a public link) need TestFlight Test Information
(a description, a feedback email and a privacy policy URL) and a short Beta App Review.

## 7. Run the first build

Actions → **iOS TestFlight** → Run workflow (from `main`) → approve it when GitHub asks. The build number is the
workflow run number and always goes up. After the upload Apple processes the build for 5 to 30 minutes, and
then it appears under TestFlight. The workflow signs with `app/ios/App/App/App-TestFlight.entitlements`, which is
empty on purpose.

## Adding push notifications

Nothing in the app depends on push yet: the only thing the server sends is an "Import complete" notice. When it is
needed:

1. Enable **Push Notifications** on the App ID (step 2).
2. Add `aps-environment` (value `production`) to `App-TestFlight.entitlements`.
3. Create an APNs key: Certificates, Identifiers & Profiles → Keys → **+** → Apple Push Notifications service
   (APNs). Download the `.p8` once, and note the Key ID.
4. In Firebase (Project settings → Cloud Messaging → the iOS app `nz.tak.app`), upload that key with its Key ID and your Team ID.
5. Download `GoogleService-Info.plist` for the iOS app from Firebase, base64 it, and store it as the secret
   `GOOGLE_SERVICE_INFO_PLIST_B64`. The workflow writes it into the project. Without the secret the build has no
   Firebase config and push stays off.
6. On the server, an admin pastes the Firebase service-account details under Admin settings → Notifications.

## Associated domains (later)

`App.entitlements` lists `webcredentials:cloudtak.io`, which is upstream's domain. It is only needed for passkey and
password autofill, and passkeys are web-only in the app, so it is left out of the TestFlight entitlements. If it
is needed later, enable **Associated Domains** on the App ID, add `webcredentials:<your domain>` and host
`/.well-known/apple-app-site-association` on that domain.

## Other restricted entitlements

`App.entitlements` also has location push and the carrier-constrained and network-slicing groups. These need a
capability on the App ID and some need Apple's approval, so none is in the first builds. Add them to the TestFlight file
only one at a time, after the capability is enabled and approved.

## Account type and moving later

- **Individual** accounts show the owner's **personal legal name** as the seller on the App Store. **Organization**
  accounts show the legal entity's name. Decide before the first public release.
- To change from Individual to Organization, **contact Apple Developer Support**. It isn't self-service
  (<https://developer.apple.com/support/enrollment/>). The organization must be a legal entity with a D-U-N-S number
  (free in most countries), a public website and a work email on its domain, and someone with legal authority to sign.
  Apple calls it converting the account, so the Team ID should stay the same and nothing in this guide changes, but
  confirm that with Support before relying on it.
- **Non-profits** can ask for a **fee waiver** on the annual fee, as long as the account is an organization, is not selling
  digital goods or paid apps, and is a legal non-profit. The Account Holder can request it any time before the
  membership expires (<https://developer.apple.com/support/membership-fee-waiver/>).
- **Moving an app to another account** (App Transfer) needs a version that has already been released on the App Store,
  and TestFlight switched off first (all builds and testers removed). The bundle ID, reviews and users stay. Push keys
  have to be recreated in the new account, and **Sign in with Apple** needs a transfer identifier for every user
  (<https://developer.apple.com/help/app-store-connect/transfer-an-app/overview-of-app-transfer/>). So convert the
  account before the first public release if you can, as a conversion avoids a transfer.
- If the team does change: replace the four secrets (and the Firebase and APNs setup), register `nz.tak.app` again if
  it is not carried over, and re-run the workflow. Nothing in the code refers to a Team ID: the workflow passes it in.
- The **Account Holder** role can be handed to another person. Apple documents the process in App Store Connect Help
  ("Transfer the Account Holder role"), so look that up rather than sharing a login.

## Rotating or revoking the API key

Users and Access → Integrations → App Store Connect API → revoke the key, create a new one (step 4), and update the three
`ASC_*` secrets. Revoke the key at once if the `.p8` might have leaked, since it has the Admin role.

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| "not a valid name for an app id" | The App ID description has a dot or symbol. Use letters, numbers and spaces only: `TAK NZ`. |
| English (New Zealand) is missing | It is not offered. Use English (U.K.). |
| No **Users** item under Users and Access | It is called **People**. |
| Workflow can't start | It runs only from `main`, and needs an approval on the `ios-testflight` environment. |
| `Secret ... is not set` at the start | One of the four secrets is missing. Check the names exactly. |
| Signing fails ("No profiles", "Failed to create provisioning profile", authentication errors) | The API key role is not Admin, the App ID or app record does not match `nz.tak.app`, or an agreement in the developer account or App Store Connect needs accepting. |
| A capability error such as "Personal development teams do not support ..." or "doesn't include the ... entitlement" | An entitlement was added to `App-TestFlight.entitlements` without the capability on the App ID. Remove it or enable the capability. |
| Upload is refused for the build number | The build number must be higher than the last upload of that version. The run number does this, so re-run rather than re-using an old one. |
| Upload works, but nothing appears in TestFlight | Processing takes 5 to 30 minutes. Check the email from App Store Connect for a rejection (for example a missing icon or usage description). |
| You are not offered the build on the iPhone | You are not in the Internal Testing group, or you are signed in to TestFlight with a different Apple Account. |
| "Firebase was not configured: GoogleService-Info.plist is missing" in the app log, or push does not work | Expected until [push is set up](#adding-push-notifications). The Firebase plugin logs this and carries on without push. |
| No shared scheme found | The project has no committed scheme. Xcode generates one. The workflow logs list the schemes. |
| The compile check fails on a pull request | It uses no secrets. Read the Xcode log artifact. A common cause is a new Swift package or a changed `ios/` file. |

## References

- Enrolment, account types, conversion: <https://developer.apple.com/support/enrollment/>
- Fee waiver: <https://developer.apple.com/support/membership-fee-waiver/>
- Add and edit users: <https://developer.apple.com/help/app-store-connect/manage-your-team/add-and-edit-users/>
- Internal testers: <https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/>
- Cloud-managed certificates: <https://developer.apple.com/help/account/certificates/cloud-managed-certificates/>
- App Transfer: <https://developer.apple.com/help/app-store-connect/transfer-an-app/overview-of-app-transfer/>
