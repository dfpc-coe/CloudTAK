import fs from 'node:fs/promises';
import CP from 'child_process';
import StaticCapabilities, { CAPABILITIES_ANNOTATION } from '../api/node_modules/@tak-ps/etl/dist/src/capabilities.js';

/**
 * Build and push docker containers to AWS ECR
 * Usage:
 *    node build.js            # builds and pushes all containers
 *    node build.js api        # builds and pushes only the API container
 *    node build.js <taskname> # builds and pushes only the specified task container
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

/**
 * AWS Lambda accepts OCI Image Manifests (spec v1.0.0 and up) as long as the image
 * is a single-platform image manifest and not an OCI Image Index (multi-platform or
 * provenance-wrapped builds). Manifest annotations are part of that supported surface,
 * so a capabilities.json document located alongside the source code is embedded in
 * the image manifest as an OCI annotation and later retrieved via ECR BatchGetImage.
 *
 * Note: the annotated path must push directly from buildx (--push) - a --load
 * into the classic Docker image store followed by `docker push` drops annotations.
 */
async function capabilities(path) {
    let doc;
    try {
        doc = await StaticCapabilities.read(path);
    } catch (err) {
        console.error(`not ok - ${path}: ${err.message}`);
        process.exit(1);
    }

    return doc ? JSON.stringify(doc) : null;
}

async function cloudtak_etl() {
    // Get Git Repo Name
    const basename = (CP.execSync(`
        basename $(git rev-parse --show-toplevel)
    `)).toString().trim();

    const version = (CP.execSync(`
        jq .version ./package.json | tr -d '"'
    `)).toString().trim();

    const caps = await capabilities('./capabilities.json');

    if (!caps) {
        console.error('not ok - ETL builds require a capabilities.json alongside the source code');
        process.exit(1);
    }

    console.error('ok - found capabilities.json - annotating manifest');

    return new Promise((resolve, reject) => {
        const $ = CP.exec(`
            docker buildx build . \
                --platform linux/amd64 \
                --provenance=false \
                --annotation "${CAPABILITIES_ANNOTATION}=$\{CLOUDTAK_CAPABILITIES}" \
                --output type=image,oci-mediatypes=true,push=true \
                -t "$\{AWS_ACCOUNT_ID}.dkr.ecr.$\{AWS_REGION}.amazonaws.com/tak-vpc-${process.env.Environment}-cloudtak-tasks:${basename}-v${version}"
        `, {
            env: { ...process.env, CLOUDTAK_CAPABILITIES: caps }
        }, (err) => {
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

    const caps = await capabilities(new URL(`../tasks/${task}/capabilities.json`, import.meta.url));
    if (caps) console.error(`ok - found tasks/${task}/capabilities.json - annotating manifest`);

    return new Promise((resolve, reject) => {
        const cmd = caps ? `
            docker buildx build --platform linux/amd64 --provenance=false -f ./tasks/$\{TASK}/Dockerfile . \
                --annotation "${CAPABILITIES_ANNOTATION}=$\{CLOUDTAK_CAPABILITIES}" \
                --output type=image,oci-mediatypes=true,push=true \
                -t "$\{AWS_ACCOUNT_ID}.dkr.ecr.$\{AWS_REGION}.amazonaws.com/tak-vpc-${process.env.Environment}-cloudtak-api:$\{TASK}-$\{GITSHA}"
        ` : `
            docker buildx build --platform linux/amd64 --provenance=false --load -f ./tasks/$\{TASK}/Dockerfile . -t cloudtak-$\{TASK} \
            && docker tag cloudtak-$\{TASK}:latest "$\{AWS_ACCOUNT_ID}.dkr.ecr.$\{AWS_REGION}.amazonaws.com/tak-vpc-${process.env.Environment}-cloudtak-api:$\{TASK}-$\{GITSHA}" \
            && docker push "$\{AWS_ACCOUNT_ID}.dkr.ecr.$\{AWS_REGION}.amazonaws.com/tak-vpc-${process.env.Environment}-cloudtak-api:$\{TASK}-$\{GITSHA}"
        `;

        const $ = CP.exec(cmd, {
            env: caps ? { ...process.env, CLOUDTAK_CAPABILITIES: caps } : process.env
        }, (err) => {
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
