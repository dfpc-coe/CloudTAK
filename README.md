<h1 align=center>TAK ETL</h1>

<p align=center>Facilitate ETL operations to bring non-TAK sources into a TAK Server</p>

## Installation

Local installation can take advantage of the docker-compose workflow.

```
docker-compose up --build
```

Once the database and API service have built, the server will start on port 5000.
In your webbrowser visit `http://localhost:5000` to view the stats

Installation outside of the docker environment is also fairly straightforward.
In the `./api`, perform the following

```sh
npm install
echo "CREATE DATABASE tak_ps_stats" | psql
npx knex migrate:latest
cd web/
npm install
npm run build
cd ..
npm run dev
```

## AWS Deployment

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
```

```
npx deploy update <stack>
```

```
npx deploy info <stack> --outputs
```

```
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

