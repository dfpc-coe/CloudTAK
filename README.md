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

