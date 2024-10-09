#! /usr/bin/env node

import fs from 'node:fs/promises';
import CP from 'child_process';

process.env.GITSHA = sha();

for (const env of ['GITSHA', 'AWS_REGION', 'AWS_ACCOUNT_ID']) {
    if (!process.env[env]) {
        console.error(`${env} Env Var must be set`);
        process.exit();
    }
}

await login();


if (!process.argv[2]) {
    console.error('ok - building all containers');

    await api();

    for (const dir of await fs.readdir(new URL('./tasks/', import.meta.url))) {
        await task(dir);
    }
} else {
    if (process.argv[2] === 'api') {
        await api();
    } else {
        await task(process.argv[2]);
    }
}

function login() {
    return new Promise((resolve, reject) => {
        const $ = CP.exec(`
            aws ecr get-login-password \
                --region $\{AWS_REGION\} \
            | docker login \
                --username AWS \
                --password-stdin "$\{AWS_ACCOUNT_ID\}.dkr.ecr.$\{AWS_REGION\}.amazonaws.com"

        `, (err) => {
            if (err) return reject(err);
            return resolve();
        });

        $.stdout.pipe(process.stdout);
        $.stderr.pipe(process.stderr);
    });

}

function api() {
    return new Promise((resolve, reject) => {
        const $ = CP.exec(`
            docker compose build api \
            && docker tag cloudtak-api:latest "$\{AWS_ACCOUNT_ID\}.dkr.ecr.$\{AWS_REGION\}.amazonaws.com/coe-ecr-etl:$\{GITSHA\}" \
            && docker push "$\{AWS_ACCOUNT_ID\}.dkr.ecr.$\{AWS_REGION\}.amazonaws.com/coe-ecr-etl:$\{GITSHA\}"
        `, (err) => {
            if (err) return reject(err);
            return resolve();
        });

        $.stdout.pipe(process.stdout);
        $.stderr.pipe(process.stderr);
    });
}

async function task(task) {
    process.env.TASK = task;

    return new Promise((resolve, reject) => {
        const $ = CP.exec(`
            docker buildx build ./tasks/$\{TASK\}/ -t cloudtak-$\{TASK\} \
            && docker tag cloudtak-$\{TASK\}:latest "$\{AWS_ACCOUNT_ID\}.dkr.ecr.$\{AWS_REGION\}.amazonaws.com/coe-ecr-etl:$\{TASK\}-$\{GITSHA\}" \
            && docker push "$\{AWS_ACCOUNT_ID\}.dkr.ecr.$\{AWS_REGION\}.amazonaws.com/coe-ecr-etl:$\{TASK\}-$\{GITSHA\}"
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
        '--git-dir', new URL('.git', import.meta.url).pathname,
        'rev-parse', 'HEAD'
    ]);

    if (!git.stdout) return (new Error('Is this a git repo? Could not determine GitSha'));
    return String(git.stdout).replace(/\n/g, '');

}
