<h1 align=center>CloudTAK</h1>

<p align=center>Facilitate ETL operations to bring non-TAK sources into a TAK Server</p>

<img src='./docs/Screenshot.png' alt='Screenshot of CloudTAK'/>

## Installation

Local installation can take advantage of the docker-compose workflow.

```
docker-compose up --build
```

Once the database and API service have built, the server will start on port 5000.
In your webbrowser visit `http://localhost:5000` to view the ETL UI

For non-aws environments, the default username & password is `admin`, `admin`.
This value can be customized via the `TAK_USERNAME` & `TAK_PASSWORD` env vars

Installation outside of the docker environment is also fairly straightforward.
In the `./api`, perform the following

```sh
npm install
echo "CREATE DATABASE tak_ps_etl" | psql
npx knex migrate:latest
cd web/
npm install
npm run build
cd ..
npm run dev
```

## AWS Deployment

### Pre-Reqs

The ETL service assumes several pre-requisite dependencies are deployed before
initial ETL deployment.
The following are dependencies which need to be created:

| Name                  | Notes |
| --------------------- | ----- |
| `coe-vpc-<name>`      | VPC & networking to place tasks in - [repo](https://github.com/dfpc-coe/vpc) |
| `coe-ecs-<name>`      | ECS Cluster for API Service - [repo](https://github.com/dfpc-coe/ecs) |
| `coe-ecr-etl`         | ECR Repository for storing API Images - [repo](https://github.com/dfpc-coe/ecr)     |
| `coe-ecr-etl-tasks`   | ECR Repository for storing Task Images - [repo](https://github.com/dfpc-coe/ecr)  |
| `coe-elb-access`      | Centralized ELB Logs - [repo](https://github.com/dfpc-coe/elb-logs) |


### Optional Dependencies that can be deployed at any time

| Name                  | Notes |
| --------------------- | ----- |
| `coe-media-<name>`   | Task Definitions for Media Server Support - [repo](ttps://github.com/dfoc-coe/media-infra)  |

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

### ETL Deployment

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

