<p align=center><img src='./docs/CloudTAKLogo.svg' alt='CloudTAK Logo' width='128'/></p>

<h1 align=center>CloudTAK</h1>

<p align=center>Full Featured in-browser TAK Client powered by AWS</p>
<p align=center>&</p>
<p align=center>Facilitate ETL operations to bring non-TAK data sources into a TAK Server</p>

<img src='./docs/Screenshot.png' alt='Screenshot of CloudTAK'/>

## Installation

Testing locally can be done either running the server directly (recommended for development) or
by running the provided Docker Compose services (recommended for limited testing)

Note that for full functionality, CloudTAK needs to be deployed into an AWS environment and that
many of the services it provides will initiate AWS API calls with no graceful fallback.

### Docker Compose

```
docker compose up --build
```

Once the database and API service have built, the server will start on port 5000.
In your webbrowser visit `http://localhost:5000` to view the ETL UI

### Local Development

Installation outside of the docker environment is also fairly straightforward.
In the `./api`, perform the following

```sh
npm install
echo "CREATE DATABASE tak_ps_etl" | psql
cd web/
npm install
npm run build
cd ..
npm run dev
```

## Initial Configuration

Almost all values with the exception of the initial Postgres Connection string are stored in the database and can be
changed via the Administrative Interface in the Web UI.

Alternatively, values can be configured by setting Environment Variables on launch. Note that if this is done,
environment variables present at launch they will OVERRIDE any values that might be present in the database

### CloudTAK Config Values

Any of the listed config keys present in the `POST /config` API can all be set via Env Vars at startup.

To do so, follow the following formatting rules:
- Append `CLOUDTAK_Config_`
- Replace any instance of `::` with `_`
- All characters after `CLOUDTAK_Config_` are case SENSITIVE

For example:
- `media::url` would map to: `CLOUDTAK_Config_media_url`
- `group::Brown` would map to: `CLOUDTAK_Config_group_Brown`

## AWS Deployment

### 1. Pre-Reqs

The ETL service assumes several pre-requisite dependencies are deployed before
initial ETL deployment.
The following are dependencies which need to be created:

| Name                  | Notes |
| --------------------- | ----- |
| `coe-vpc-<name>`      | VPC & networking to place tasks in - [repo](https://github.com/dfpc-coe/vpc)      |
| `coe-ecs-<name>`      | ECS Cluster for API Service - [repo](https://github.com/dfpc-coe/ecs)             |
| `coe-ecr-etl`         | ECR Repository for storing API Images - [repo](https://github.com/dfpc-coe/ecr)   |
| `coe-ecr-etl-tasks`   | ECR Repository for storing Task Images - [repo](https://github.com/dfpc-coe/ecr)  |
| `coe-elb-access`      | Centralized ELB Logs - [repo](https://github.com/dfpc-coe/elb-logs)               |

An AWS ACM certificate must also be generated that covers the subdomain that CloudTAK is deployed to as well
as the second level wildcard. Where in the example below CloudTAK is deployed to ie: `map.example.com` The second
level wildcard will be used for serving tiles, currently configured to be `tiles.map.example.com`

IE:
```
*.example.com
*.map.example.com
```

**coe-ecr-etl**

Can be created using the [dfpc-coe/ecr](https://github.com/dfpc-coe/ecr) repository.

From the ecr repo:
```sh
npm install
npx deploy create etl
```

**coe-ecr-etl-tasks**

Can be created using the [dfpc-coe/ecr](https://github.com/dfpc-coe/ecr) repository.

From the ecr repo:
```sh
npm install
npx deploy create etl-tasks
```

### 2. Installing Dependencies

From the root directory, install the deploy dependencies

```sh
npm install
```

### 3. Building Docker Images & Pushing to ECR

An script to build docker images and publish them to your ECR is provided and can be run using:

```
npm run build
```

from the root of the project. Ensure that you have created the necessary ECR repositories as descrived in the
previos step and that you have AWS credentials provided in your current terminal environment as an `aws ecr get-login-password`
call will be issued.

### Deployment

From the root directory, install the deploy dependencies

```sh
npm install
```

Deployment to AWS is handled via AWS Cloudformation. The template can be found in the `./cloudformation`
directory. The deployment itself is performed by [Deploy](https://github.com/openaddresses/deploy) which
was installed in the previous step.

The deploy tool can be run via the following

```sh
npx deploy
```

To install it globally - view the deploy [README](https://github.com/openaddresses/deploy)

Deploy uses your existing AWS credentials. Ensure that your `~/.aws/credentials` has an entry like:

```
[coe]
aws_access_key_id = <redacted>
aws_secret_access_key = <redacted>
```

Deployment can then be performed via the following:

```
npx deploy create <stack>
npx deploy update <stack>
npx deploy info <stack> --outputs
npx deploy info <stack> --parameters
```

Stacks can be created, deleted, cancelled, etc all via the deploy tool. For further information
information about `deploy` functionality run the following for help.

```sh
npx deploy
```

Further help about a specific command can be obtained via something like:

```sh
npx deploy info --help
```

### Optional Dependencies that can be deployed at any time

| Name                  | Notes |
| --------------------- | ----- |
| `coe-media-<name>`   | Task Definitions for Media Server Support - [repo](ttps://github.com/dfoc-coe/media-infra) |


### S3 Bucket Contents

An S3 bucket will be created as part of the CloudFormatiom stack that contains geospatial assets
related to user files, missions, CoTs, etc. The following table is an overview of the prefixes
in the bucket and their purpose

| Prefix | Description |
| ------ | ----------- |
| `attachment/{sha256}/{file.ext}`  | CoT Attachments by Data Package reported SHA |
| `data/{data sync id}/{file.ext}`  | CloudTAK managed Data Sync file contents |
| `import/{UUID}/{file.ext}`        | User Imports |
| `profile/{email}/{file.ext}`      | User Files |

