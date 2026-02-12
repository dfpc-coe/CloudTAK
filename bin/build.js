import fs from 'node:fs/promises';
import CP from 'child_process';

/**
 * Build and push docker containers to AWS ECR
 * Usage:
 *    node build.js            # builds and pushes all containers
 *    node build.js api        # builds and pushes only the API container
 *    node build.js <taskname> # builds and pushes only the specified task container
 *    node build.js .          # Build an ETL task in the current directory
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
        await cloudtak_etl();
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

function cloudtak_etl() {
    // Get Git Repo Name
    const basename = (CP.execSync(`
        basename $(git rev-parse --show-toplevel)
    `)).toString().trim();

    const version = (CP.execSync(`
        jq .version ./package.json | tr -d '"'
    `)).toString().trim();

    return new Promise((resolve, reject) => {
        const $ = CP.exec(`
            docker build -t ${basename}:${version} . \
            && docker tag ${basename}:${version} "$\{AWS_ACCOUNT_ID}.dkr.ecr.$\{AWS_REGION}.amazonaws.com/tak-vpc-${process.env.Environment}-cloudtak-tasks:${basename}-v${version}" \
            && docker push "$\{AWS_ACCOUNT_ID}.dkr.ecr.$\{AWS_REGION}.amazonaws.com/tak-vpc-${process.env.Environment}-cloudtak-tasks:${basename}-v${version}"
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

    return new Promise((resolve, reject) => {
        const $ = CP.exec(`
            docker compose build ${buildArgs} api \
            && docker tag cloudtak-api:latest "$\{AWS_ACCOUNT_ID}.dkr.ecr.$\{AWS_REGION}.amazonaws.com/tak-vpc-${process.env.Environment}-cloudtak-api:$\{GITSHA}" \
            && docker push "$\{AWS_ACCOUNT_ID}.dkr.ecr.$\{AWS_REGION}.amazonaws.com/tak-vpc-${process.env.Environment}-cloudtak-api:$\{GITSHA}"
        `, (err) => {
            if (err) return reject(err);
            return resolve();
        });

        $.stdout.pipe(process.stdout);
        $.stderr.pipe(process.stderr);
    });
}

async function cloudtak_task(task) {
    process.env.TASK = task;

    return new Promise((resolve, reject) => {
        const $ = CP.exec(`
            docker buildx build --platform linux/amd64 --provenance=false --load ./tasks/$\{TASK}/ -t cloudtak-$\{TASK} \
            && docker tag cloudtak-$\{TASK}:latest "$\{AWS_ACCOUNT_ID}.dkr.ecr.$\{AWS_REGION}.amazonaws.com/tak-vpc-${process.env.Environment}-cloudtak-api:$\{TASK}-$\{GITSHA}" \
            && docker push "$\{AWS_ACCOUNT_ID}.dkr.ecr.$\{AWS_REGION}.amazonaws.com/tak-vpc-${process.env.Environment}-cloudtak-api:$\{TASK}-$\{GITSHA}"
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
