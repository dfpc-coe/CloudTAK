import fs from 'node:fs/promises';
import CP from 'child_process';

/**
 * Build and push docker containers to AWS ECR
 * Usage:
 *    node build.js            # builds and pushes all containers
 *    node build.js api        # builds and pushes only the API container
 *    node build.js <taskname> # builds and pushes only the specified task container
 *
 * Environment may be a comma separated list of environments in the same
 * AWS account - the image is built once and pushed to each of them
 *
 * Note: ETL task containers are built from their own repositories with the
 * cloudtak-etl CLI published by @tak-ps/etl - `npx cloudtak-etl`
 */

process.env.GITSHA = sha();

process.env.Environment = process.env.Environment || 'prod';

for (const env of [
    'GITSHA',
    'AWS_REGION',
    'AWS_ACCOUNT_ID',
    'Environment'
]) {
    if (!process.env[env]) {
        throw new Error(`${env} Env Var must be set`);
    }
}

const environments = process.env.Environment.split(',').map((e) => e.trim()).filter(Boolean);

await login();

const args = process.argv.slice(2);
const plugins = [];
let target = null;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--plugin') {
        if (args[i + 1]) {
            plugins.push(args[i + 1]);
            i++;
        }
    } else if (!target) {
        target = args[i];
    }
}

if (!target) {
    console.error('ok - building all containers');

    await cloudtak_api(plugins);

    for (const dir of await fs.readdir(new URL('../tasks/', import.meta.url))) {
        await cloudtak_task(dir);
    }
} else {
    if (target === 'api') {
        await cloudtak_api(plugins);
    } else if (target === '.') {
        console.error('not ok - ETL builds have moved to the cloudtak-etl CLI - run `npx cloudtak-etl` from the ETL repo');
        process.exit(1);
    } else {
        await cloudtak_task(target);
    }
}

function login() {
    return new Promise((resolve, reject) => {
        const $ = CP.exec(`
            aws ecr get-login-password \
                --region $\{AWS_REGION} \
            | docker login \
                --username AWS \
                --password-stdin "$\{AWS_ACCOUNT_ID}.dkr.ecr.$\{AWS_REGION}.amazonaws.com"

        `, (err) => {
            if (err) return reject(err);
            return resolve();
        });

        $.stdout.pipe(process.stdout);
        $.stderr.pipe(process.stderr);
    });

}

function cloudtak_api(plugins = []) {
    const buildArgs = plugins.length ? `--build-arg WEB_PLUGINS="${plugins.join(',')}"` : '';

    return build('api', `${buildArgs} ${tags()} ./api/`);
}

function cloudtak_task(task) {
    return build(task, `-f ./tasks/${task}/Dockerfile ${tags(`${task}-`)} .`);
}

function tags(prefix = '') {
    return environments.map((environment) => {
        return `-t "$\{AWS_ACCOUNT_ID}.dkr.ecr.$\{AWS_REGION}.amazonaws.com/tak-vpc-${environment}-cloudtak-api:${prefix}$\{GITSHA}"`;
    }).join(' ');
}

function build(scope, args) {
    // GitHub Actions cache is only reachable when the runtime token is exposed to the step
    const cache = process.env.ACTIONS_RUNTIME_TOKEN
        ? `--cache-from type=gha,scope=ecr-${scope} --cache-to type=gha,mode=max,scope=ecr-${scope},ignore-error=true`
        : '';

    return new Promise((resolve, reject) => {
        const $ = CP.exec(`
            docker buildx build --platform linux/amd64 --provenance=false --push ${cache} ${args}
        `, (err) => {
            if (err) return reject(err);
            return resolve();
        });

        $.stdout.pipe(process.stdout);
        $.stderr.pipe(process.stderr);
    });
}

function sha() {
    const git = CP.spawnSync('git', [
        '--git-dir', new URL('../.git', import.meta.url).pathname,
        'rev-parse', 'HEAD'
    ]);

    if (!git.stdout) throw Error('Is this a git repo? Could not determine GitSha');
    return String(git.stdout).replace(/\n/g, '');

}
