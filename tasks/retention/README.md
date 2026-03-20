# Retention Service

Retention jobs for CloudTAK.

## Runtime Modes

- `Dockerfile.compose` starts a lightweight scheduler process and runs retention only when `node-cron` fires
- `Dockerfile` runs a one-shot retention execution suitable for ECS `RunTask` and exits when complete
