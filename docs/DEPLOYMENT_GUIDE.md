# 🚀 CloudTAK Infrastructure - Deployment Guide

## **Quick Start (Recommended)**

### **Prerequisites**
- AWS Account with configured credentials
- Base infrastructure stack (`TAK-<n>-BaseInfra`) deployed
- Public Route 53 hosted zone for your domain
- Node.js and npm installed
- Docker installed and running

### **One-Command Deployment**
```bash
# Install dependencies (from cdk directory)
cd cdk && npm install

# Deploy development environment
npm run deploy:dev

# Deploy production environment  
npm run deploy:prod
```

**That's it!** 🎉 The CDK deployment handles building, context configuration, and deployment.

---

## **📋 Environment Configurations**

| Environment | Stack Name | Domain | Features |
|-------------|------------|--------|----------|
| **dev-test** | `TAK-Dev-CloudTAK` | `map.dev.tak.nz` | Cost-optimized, Aurora provisioned `db.t4g.medium` |
| **prod** | `TAK-Prod-CloudTAK` | `map.tak.nz` | Production-ready, Aurora Multi-AZ |

---

## **🔧 Advanced Configuration**

### **Custom Stack Deployment**
```bash
# Deploy with custom stack name
npm run deploy:dev -- --context stackName=Demo
npm run deploy:prod -- --context stackName=Enterprise
```

### **Infrastructure Preview**
```bash
# Preview changes before deployment
npm run synth:dev     # Development environment
npm run synth:prod    # Production environment

# Show what would change
npm run cdk:diff:dev  # Development diff
npm run cdk:diff:prod # Production diff
```

---

## **🔌 Installing CloudTAK plugins (WEB_PLUGINS)**

CloudTAK plugins are cloned into `app/plugins/` while the Docker image is built, using
the `WEB_PLUGINS` build arg. This repo sets it from CDK config.

- **Config:** `cloudtak.webPlugins` in `cdk/cdk.json`, per environment. Comma and/or
  whitespace separated `https://github.com/<owner>/<repo>.git` URLs. `dev-test` installs
  the rubbersheet and weather plugins; `prod` is empty. Other URL forms (ssh, credentials, `#ref`,
  `file:`) are rejected at synth time.
- **Overrides:** `--context WebPlugins="<urls>"` (use `""` for none), then the
  `WEB_PLUGINS` environment variable, then `cdk.json`.
- **Manual deploy (Test stack):**
  ```bash
  npm run build && npm run cdk deploy -- \
    --context envType=dev-test \
    --context stackName=Demo \
    --context tak-project="TAK on AWS" \
    --context tak-component="CloudTAK" \
    --context tak-region=us-west-2 \
    --context useS3CloudTAKConfigFile=true \
    --require-approval never
  ```
  Add `--context WebPlugins="https://github.com/dfpc-coe/cloudtak-plugin-sample.git"` to
  install a different plugin set for that deploy.
- **CI:** the Demo build (`demo-build.yml`) uses the `dev-test` value and the production
  build uses the `prod` value from `cdk/cdk.json`. Pre-built images ignore
  `--context WebPlugins` at deploy time; the plugin set is fixed when the image is built.

**Gotchas**
- The clone happens after `COPY api/` and `COPY app/`, and it takes the plugin's
  **default branch** (`--depth 1`). A plugin-only change therefore does not change the
  image hash. In CI, re-run the build with `force_rebuild`. For a manual CDK deploy,
  change any file in `api/` or `app/` (or the plugin list) so the asset is rebuilt.
- The image build runs `npm run lint && npm run check` over `app/plugins/`, so a plugin
  must pass the app's lint and type checks or the build fails.
- Plugin dependencies must already be in `app/package.json` and its lockfile, because
  `npm ci` runs before plugins are cloned.
- After a deploy, users need Settings -> Refresh App to pick up the new plugin bundle.

### **Weather plugin (cloudtak-plugin-weather)**
Adds a weather button under the 3D terrain button in the map's left controls; it opens a bottom
bar with rain, global rain, cloud and radar layers, a timeline slider (the last 2 hours and the rain
forecast) and a Play button. Tiles come from the weather-proxy through a CloudTAK API relay
(`/api/weather`), so browsers never see the proxy URL or key.

| Variable | Required | Rule |
|----------|----------|------|
| `WEATHER_PROXY_URL` | Yes | `https` URL, no query, fragment or credentials; a trailing slash is stripped |
| `WEATHER_PROXY_KEY` | Yes | Characters `[A-Za-z0-9._~-]`, 16 to 128 long |
| `WEATHER_RATE_LIMIT` | No | Tile requests per user per minute, 60 to 6000, default 900 |

- **Where:** the variables live in `s3://<config bucket>/cloudtak-config.env` (see
  `cloudtak-config.env.example`) and only apply with `--context useS3CloudTAKConfigFile=true`.
  The `dev-test` default in `cdk.json` is `false`. The manual deploy command above already
  sets it.
- **Helper script:** `scripts/set-weather-proxy-config.sh` sets the variables in that file
  (see below).
- **Upstream limits:** each API task makes at most 500 weather-proxy fetches a minute (the
  proxy allows 600 per client IP). After a 429 from the proxy the task pauses upstream fetches
  for 5 to 120 s; cached tiles are still served and uncached tiles get `429` with `Retry-After`.
- **Snapshots and caching:** `GET /api/weather/status` also reports the newest snapshot per layer
  (`latest`), read from the weather-proxy's `/snapshot` endpoint (cached 30 s; an older proxy
  without it is tolerated and the clock-based value is used). Tiles that the proxy confirms for an
  explicitly requested (pinned) snapshot are cached 7200 s at the relay and 3600 s in the browser;
  requests without a snapshot, with `snapshot=latest` or clamped to a lagging layer, and all other
  tiles keep 600 s.
- **Cost of one Play pass:** one pass is `13 frames x visible tiles x layers` uncached upstream
  fetches (37 frames for Rain layers, because "Include forecast when playing" is on by default; Clouds and Radar always use 13). Measured in a real browser with 512 px
  tiles: about 20 tiles per layer and frame on a 1900 x 1400 screen (about 48 with Sharper 256 px
  tiles) and 2 tiles on a 390 x 844 phone (8 with Sharper). Three layers on a desktop screen are
  therefore about 780 fetches for the past frames (about 1,260 with the forecast), above the 500
  fetches per minute per task cap. The plugin therefore paces the first pass to about 180 tiles a
  minute (a burst of 90, so no 60 s window holds more than 270): with Clouds, Rain Regional and
  Radar and the forecast on, a 1900 x 1400 screen needs about 6.5 minutes for the first pass and
  made no request that was answered 429 in the measurement. Several layers with Sharper tiles can
  still exceed the limits; Play then pauses on the 429 and resumes (by itself after at most a
  minute, or when the user presses Play). A phone needs about 80, which fits into the burst. The
  second pass over the same frames made no request to the
  relay in the measurement (browser cache, 3600 s); other users are served from the relay cache
  (up to 7200 s). The limits are unchanged (900 tile requests per user and minute, 500 upstream
  fetches per task and minute).
- **Tile formats:** tiles are PNG, except `clouds` tiles, which are WebP. The relay detects the
  format from the image bytes and sets the `Content-Type`, so no weather-proxy change is needed.
- **Restart:** values are read at request time but injected when the task starts. After
  changing the file, deploy or run `aws ecs update-service --force-new-deployment` so a new
  task picks them up.
- **Test values:** `WEATHER_PROXY_URL=https://utils.test.tak.nz/weather-radar`.
- **Key:** add a dedicated client entry to the weather-proxy key file with
  `providers: ["rainbow"]` and a rate limit sized for the relay. Never reuse another
  consumer's key.
- **Check:** after deploy, `curl -s -H "Authorization: Bearer $TOKEN" https://map.test.tak.nz/api/weather/status`
  should return `"enabled":true`.
- **Rebuild:** the plugin is cloned from the default branch of
  `TAK-NZ/cloudtak-plugin-weather`, so plugin changes need an image rebuild (CI
  `force_rebuild`, or change a file under `api/` or `app/` before a manual CDK deploy).
- **Users:** Settings -> Refresh App after the deploy.

#### Setting the weather variables with the helper script
`scripts/set-weather-proxy-config.sh` replaces `WEATHER_PROXY_URL`, `WEATHER_PROXY_KEY` and
(optionally) `WEATHER_RATE_LIMIT` in `s3://<config bucket>/cloudtak-config.env`. The bucket is
resolved from the export `TAK-<stack name>-BaseInfra-EnvConfigBucket` (stack name `Demo` by
default). Every other line of the file is kept as it is. The three variables are written as one
block between `# BEGIN weather-proxy (managed by ...)` and `# END weather-proxy`, so running it
again changes nothing.

1. Put the key alone in a file that only you can read, for example
   `install -m 600 /dev/null ~/weather.key` and then paste the key into it. The script refuses
   a key file with a mode other than 600 or 400. Without `--key-file` it asks for the key with a
   hidden prompt.
2. Run a dry run first. It downloads the file, writes the backup and shows the change, but
   uploads nothing.

   ```bash
   # Test (profile default, region us-west-2)
   scripts/set-weather-proxy-config.sh --profile default --region us-west-2 \
       --url https://utils.test.tak.nz/weather-radar --key-file ~/weather.key --dry-run

   # Demo (profile tak-nz-demo, region ap-southeast-2)
   scripts/set-weather-proxy-config.sh --profile tak-nz-demo --region ap-southeast-2 \
       --url https://utils.test.tak.nz/weather-radar --key-file ~/weather.key --dry-run
   ```
3. Remove `--dry-run` to upload. The script asks for confirmation unless `--yes` is given, then
   downloads the file again and checks that exactly the `WEATHER_*` names are present and the
   other lines are unchanged.
4. Start a new deployment. The script does not do it; it prints the command:
   `aws --profile <profile> --region <region> ecs update-service --cluster TAK-<stack>-BaseInfra --service TAK-<stack>-CloudTAK --force-new-deployment`.

- **Backup:** the config buckets are not versioned (Test never enabled it, Demo suspended it),
  so the script first saves the current file as
  `~/.cloudtak-config-backups/<account>-<region>-<UTC time>.env` (directory mode 700, file mode
  600). To undo a change, copy that file back with `aws s3 cp`.
- **Key handling:** the key is never printed or logged and is not part of any command line or
  environment. It only exists in the key file and in a private temporary file that is deleted at
  exit. A later backup contains the key of an earlier run, so keep the backup directory private.
- **Options:** `--rate N` also sets `WEATHER_RATE_LIMIT` (without it an existing
  `WEATHER_RATE_LIMIT` line is removed and the default of 900 applies), `--stack-name` and
  `--bucket` select another stack or bucket, `--help` lists everything.
- **Key format:** the script accepts 16 to 256 characters of `A-Za-z0-9._~+/=-` but warns when
  the key is outside what the relay accepts (`A-Za-z0-9._~-`, 16 to 128), because the relay
  would then stay disabled.

### **SAR travel-time plugin (cloudtak-plugin-sar)**
Adds two search and rescue planning tools for New Zealand: the user picks an Initial Planning
Point on the map and gets either travel-time contours (a walking speed and time bands) or TARR
range rings (Koester subject-distance rings for a chosen subject profile, adjusted for terrain).
The calculation runs in the SAR engine; CloudTAK calls it
through an API relay (`/api/sar`), so browsers never see the engine URL or key.

| Variable | Required | Rule |
|----------|----------|------|
| `SAR_SERVICE_URL` | Yes | `https` URL of the SAR engine, may include a path such as `/sar`; no query, fragment or credentials; a trailing slash is stripped |
| `SAR_SERVICE_KEY` | Yes | Characters `[A-Za-z0-9._~-]`, 16 to 128 long |
| `SAR_RATE_LIMIT` | No | Calculations per user per minute, 1 to 60, default 6. Travel-time and TARR calls count together |

- **Where:** the variables live in `s3://<config bucket>/cloudtak-config.env` (see
  `cloudtak-config.env.example`) and only apply with `--context useS3CloudTAKConfigFile=true`,
  like the weather variables. Add three plain `KEY=value` lines (no quotes, no `export`). There is
  no helper script for SAR.
- **Never logged:** the key is not written to logs or sent to browsers. An invalid value is
  reported once in the log by variable name only, and the relay stays disabled.
- **Limits:** a request body is limited to 8 KB. Each calculation can take up to a minute on the
  first call; the relay waits 70 seconds for the engine (the load balancer idle timeout is already
  4000 s). A slow or unavailable engine gives `504` with `Retry-After: 30`.
- **Test values:** `SAR_SERVICE_URL=https://utils.test.tak.nz/sar`. Use the dedicated
  `cloudtak-relay` client entry (`apiKeys.cloudtak-relay`) of the Utils SAR engine API key file
  for `SAR_SERVICE_KEY`. Do not reuse another consumer's key and do not paste it into tickets,
  chat or shell history.
- **Restart:** values are read at request time but injected when the task starts. After changing
  the file, deploy or run `aws ecs update-service --force-new-deployment`.
- **Check:** after deploy, `curl -s -H "Authorization: Bearer $TOKEN" https://map.test.tak.nz/api/sar/status`
  should return `{"apiVersion":1,"enabled":true,"modes":["travel-time","tarr"]}`. The call does not
  contact the engine.
- **Order:** TARR needs the new SAR engine (`POST /tarr`). Upgrade the engine first. Until then
  TARR answers `SAR service unavailable` (502) and travel-time keeps working.
- **Plugin install:** `cdk/cdk.json` `dev-test` `webPlugins` lists
  `https://github.com/TAK-NZ/cloudtak-plugin-sar.git`. The image build clones the default branch of
  that repo, so merge the plugin to `main` of `TAK-NZ/cloudtak-plugin-sar` **before** building the
  image. Then rebuild the image and have users use Settings -> Refresh App.
---

## **📁 Channel folder separator (CHANNEL_FOLDER_SEPARATOR)**

The Channels panel shows channel names as folders. `BCH - Alerts - MetService` is the channel
`MetService` in the folder `Alerts` in the folder `BCH`, and a name can be a channel and a folder
at once (`Teams - AWS` and `Teams - AWS - Test`). The separator defaults to ` - ` (space, dash,
space). To change it, set `CHANNEL_FOLDER_SEPARATOR` in `s3://<config bucket>/cloudtak-config.env`
(see `cloudtak-config.env.example`). Like the weather variables, it only applies with
`--context useS3CloudTAKConfigFile=true`, and it is read when the API task starts.

- Use the same value as TAK Team Manager's `CHANNEL_FOLDER_SEPARATOR`, so both apps split names the
  same way.
- Quote it so the surrounding spaces are visible and survive editors that trim lines:
  `CHANNEL_FOLDER_SEPARATOR=" / "`. ECS passes the quotes through as part of the value, so
  CloudTAK removes one matched pair of surrounding quotes (`"` or `'`) and keeps the spaces
  between them. An unquoted value also works.
- A missing, empty or all-whitespace value falls back to ` - `. A name that has an empty folder
  segment (for example a leading or doubled separator) stays a single flat channel.

## **🚀 First-Time Setup**

### **Prerequisites**
1. **AWS Account** with appropriate permissions
2. **Base Infrastructure** deployed (`TAK-<n>-BaseInfra`)
3. **Node.js** and npm installed  
4. **AWS CLI** configured with credentials
5. **Docker** installed and running

### **Initial Setup Steps**
```bash
# 1. Clone and install
git clone <repository-url>
cd CloudTAK/cdk
npm install

# 2. Set environment variables (if using AWS profiles)
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text --profile your-profile)
export CDK_DEFAULT_REGION=$(aws configure get region --profile your-profile)

# 3. Deploy CloudTAK infrastructure
npm run deploy:dev -- --context stackName=YourStackName
```

---

## **🔄 Environment Transformation**

### **Switching Between Environment Types**

You can transform deployed environments between different configuration profiles (dev-test ↔ prod) without recreating resources from scratch.

### **Initial Deployment with Custom Configuration**
```bash
# Deploy a demo environment with dev-test configuration
npm run deploy:dev -- --context stackName=Demo
```

### **Environment Upgrade (dev-test → prod)**
```bash
# Transform to production configuration
npm run deploy:prod -- --context stackName=Demo
```

### **Environment Downgrade (prod → dev-test)**
```bash
# Scale back to development configuration
npm run deploy:dev -- --context stackName=Demo
```

---

## **🛠️ Troubleshooting**

### **Common Issues**

#### **Missing Base Infrastructure**
```
Error: Cannot import value TAK-Demo-BaseInfra-VPC-ID
```
**Solution:** Ensure base infrastructure stack is deployed first.

#### **Docker Build Issues**
```
Error: Docker build failed
```
**Solution:** Ensure Docker is running and the Dockerfiles exist (`Dockerfile` at the repository root, and `tasks/*/Dockerfile`).

### **Debug Commands**
```bash
# Check what would be deployed
npm run synth:dev
npm run synth:prod

# See differences from current state
npm run cdk:diff:dev
npm run cdk:diff:prod

# View CloudFormation events
aws cloudformation describe-stack-events --stack-name TAK-Dev-CloudTAK
```

---

## **📊 Post-Deployment**

### **Verify Deployment**
```bash
# Check stack status
aws cloudformation describe-stacks --stack-name TAK-Dev-CloudTAK

# View outputs
aws cloudformation describe-stacks --stack-name TAK-Dev-CloudTAK \
  --query 'Stacks[0].Outputs'
```

### **Access Services**
- **CloudTAK Web Interface**: `https://map.{domain}`
- **CloudTAK API**: `https://map.{domain}/api`
- **ETL Tasks**: Managed via ECS console

### **Cleanup**
```bash
# Destroy development environment
npx cdk destroy --context envType=dev-test

# Destroy production environment (use with caution!)
npx cdk destroy --context envType=prod
```

---

## **🔗 Related Documentation**

- **[Main README](../README.md)** - Project overview and quick start
- **[Architecture Guide](ARCHITECTURE.md)** - Technical architecture details
- **[Configuration Guide](PARAMETERS.md)** - Complete configuration reference
- **[Docker Image Strategy](DOCKER_IMAGE_STRATEGY.md)** - Image building and deployment strategy
