# Aurora PostgreSQL Major Upgrade Runbook (17.10 -> 18.6)

> **WARNING: this is a one-way, in-place major version upgrade with downtime.**
> Aurora cannot downgrade a cluster. The only rollback is restoring a snapshot
> into a **new** cluster. Do not deploy to `prod` before `dev-test` has been
> upgraded and verified.

Upstream CloudTAK moved its CloudFormation template to Aurora PostgreSQL 18.6.
TAK-NZ follows it by setting `database.engineVersion` to `18.6` in both
profiles of [`cdk/cdk.json`](../cdk/cdk.json).

## What the CDK change does

| Item | Before | After |
|------|--------|-------|
| `AWS::RDS::DBCluster` `EngineVersion` | `17.10` | `18.6` |
| Cluster parameter group family | `aurora-postgresql17` | `aurora-postgresql18` |
| `log_connections` in the parameter group | `1` | `all` (PG18 made this a list of stages, `1` is not an allowed value) |
| Instance classes | `db.t4g.medium` (dev-test), `db.t4g.large` x2 (prod) | unchanged |

The family change replaces `DatabaseDBParameterGroup...`. The group has no fixed
physical name, so CloudFormation creates the new group first, points the
cluster at it in the same update, then deletes the old group.

### No `AllowMajorVersionUpgrade` override

`AWS::RDS::DBCluster` has **no** `AllowMajorVersionUpgrade` property. It exists
only on `AWS::RDS::DBInstance` (checked in the live CloudFormation registry
schema and in `aws-cdk-lib`, where it is only on `CfnDBInstance`). Adding a
property override to the cluster would make CloudFormation reject the template.
Upstream's own template changes only `EngineVersion` on the cluster, and this
change does the same. The CDK does not set `EngineVersion` on the cluster
instances, so an instance-level flag would do nothing. Hence there is no
override to remove after the upgrade.

## Verified before this change

Checked against ap-southeast-2 with `aws rds describe-db-engine-versions` and
`describe-orderable-db-instance-options`:

- `18.6` is offered, parameter group family `aurora-postgresql18`.
- `17.10` lists `18.6` as a valid upgrade target with `IsMajorVersionUpgrade: true`
  (so the direct path exists).
- `db.t4g.medium`, `db.t4g.large` and `db.serverless` are all orderable on `18.6`.
- `shared_preload_libraries` (`pg_stat_statements` is an allowed value),
  `log_statement`, `log_min_duration_statement`, `log_disconnections` are valid on PG18.

**Not verified** (requires a real deployment): that CloudFormation completes the
engine change and parameter group swap in one update. Hence the staged rollout below.

## Before you start (each environment)

1. **Take a manual cluster snapshot** and wait for `available`:
   ```bash
   aws rds create-db-cluster-snapshot \
     --db-cluster-identifier <cluster-id> \
     --db-cluster-snapshot-identifier pre-pg18-$(date +%Y%m%d-%H%M) \
     --region ap-southeast-2
   ```
   Find `<cluster-id>` with
   `aws rds describe-db-clusters --query "DBClusters[].DBClusterIdentifier"`.
   Aurora also takes its own snapshot during the upgrade, but do not rely on that.
2. Confirm there are no logical replication slots (they block the upgrade):
   `SELECT * FROM pg_replication_slots;`
3. Confirm installed extensions and versions: `SELECT extname, extversion FROM pg_extension;`
   CloudTAK's migrations only create `postgis`. If `postgis_raster`,
   `postgis_topology`, `postgis_tiger_geocoder`, `address_standardizer` or
   `pgrouting` are installed, update them first as described in the
   [AWS major upgrade guide](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/USER_UpgradeDBInstance.PostgreSQL.MajorVersion.html).
4. Optional dry run: clone the cluster (`aws rds restore-db-cluster-to-point-in-time --restore-type copy-on-write ...`),
   upgrade the clone, and run the API against it.
5. Do not rotate the master password in the same deployment (RDS rejects a
   password change combined with a major upgrade).
6. Run `cd cdk && npm run cdk:diff:dev` (then `cdk:diff:prod`). Expect: cluster `EngineVersion`
   change, parameter group replacement, nothing else stateful. `scripts/github/check-breaking-changes.sh`
   flags "DatabaseCluster ... will be destroyed"; that should not appear.

## Order of rollout

1. **dev-test first.** Deploy, run the verification below, use the app for a while.
2. Only then deploy **prod**.

## Expected downtime

The cluster is unavailable while the writer (then each reader) is upgraded.
Plan for a maintenance window of roughly 15 to 45 minutes for a small cluster
(this is an estimate, not a measured value; time the dev-test upgrade and use that).
Expect API errors and ECS task health check failures during this time. ETL layers
and TAK Server connections will reconnect once the database is back. Prod has a
reader, which is upgraded after the writer and does not avoid the outage.

## After the upgrade (one-time, per environment)

Connect to the database (for example with ECS Exec into the API task, which has
network access to the private cluster) and run:

```sql
-- Upgrade extensions to the versions shipped with 18.6
ALTER EXTENSION postgis UPDATE;
-- repeat for any other extension listed by: SELECT extname FROM pg_extension;

-- Verify
SELECT postgis_full_version();
SELECT extname, extversion FROM pg_extension;
SELECT version();
```

If `postgis_full_version()` reports "NEEDS UPDATE" the `ALTER EXTENSION` was missed.
Then refresh planner statistics, which pg_upgrade does not carry over:

```sql
ANALYZE;
```

Verify the application:

- `GET /api` on the hub returns healthy and ECS targets are healthy.
- Log in, load the map, open a layer, create and read a CoT/feature.
- CloudWatch RDS alarms are not firing and `log_connections` output appears if
  `enableCloudWatchLogs` is on.

## Rollback

An in-place major upgrade **cannot be rolled back** and Aurora **forbids
downgrading** the engine version. Changing `engineVersion` back to `17.10` in
`cdk.json` will make the deployment fail.

To go back, restore the pre-upgrade snapshot into a new cluster
(`aws rds restore-db-cluster-from-snapshot --engine aurora-postgresql --engine-version 17.10 ...`),
add instances, and point the stack at it (or recreate the database from the
snapshot and import it). Writes made after the snapshot are lost. This is why
the manual snapshot and the dev-test rehearsal are mandatory.

If CloudFormation rolls the stack back by itself after a failed update, check the
stack events and `aws rds describe-db-clusters` for the actual engine version
before doing anything else; the cluster may already be on 18.6.

## Local development

Nothing else in this repository is changed by the upgrade. No workflow starts a
Postgres service container and there is no docker-compose file here. Upstream's
dev compose file still uses `postgis/postgis:17-3.4-alpine`, so nothing in `api/`
requires PG18. A local Postgres can stay on 17.
