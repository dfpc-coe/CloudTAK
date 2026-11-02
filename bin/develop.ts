#!/usr/bin/env node
import fs from 'node:fs/promises';
import { execFile, spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

/**
 * Point a local CloudTAK development environment at a deployed stack
 *
 * Usage:
 *    npm run dev                                   # cotak-prod
 *    npm run dev -- <stack> [options]
 *
 * Options:
 *    --profile <aws-profile>    AWS profile (default: .deploy profile, "coestaging" for *staging* stacks)
 *    --region <aws-region>      AWS region (default: .deploy region, us-east-1 for *staging* stacks)
 *    --api-url <url|stack>      API_URL written to api/.env-<stack> (default: http://localhost:8080)
 *    --pmtiles-url <url|stack>  PMTILES_URL written to api/.env-<stack> (default: http://localhost:5002)
 *    --no-dump                  Skip the database dump/load and reuse the local tak_ps_etl
 *    --show-url                 Print the deployed database URL and exit
 *
 * Writes api/.env-<stack> and tasks/pmtiles/.env-<stack>, loads a fresh dump of the
 * deployed database into the local tak_ps_etl database and then starts the API
 * (http://localhost:5001) and PMTiles (http://localhost:5002) dev servers.
 *
 * API_URL defaults to the Vite dev server so locally generated URLs (basemap
 * TileJSON, ESRI proxy, passkey origin) don't point back at the deployed stack.
 * Pass 'stack' to either URL option to use the deployed Output instead.
 */

const DEFAULT_STACK = 'cotak-prod';
const DEFAULT_API_URL = 'http://localhost:8080';
const DEFAULT_PMTILES_URL = 'http://localhost:5002';
const LOCAL_API_URL = 'http://localhost:5001';

const execFileAsync = promisify(execFile);

const root = fileURLToPath(new URL('../', import.meta.url));
const apiDir = path.join(root, 'api');
const pmtilesDir = path.join(root, 'tasks', 'pmtiles');

const { values: opts, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
        'profile': { type: 'string' },
        'region': { type: 'string' },
        'api-url': { type: 'string' },
        'pmtiles-url': { type: 'string' },
        'no-dump': { type: 'boolean' },
        'show-url': { type: 'boolean' },
        'help': { type: 'boolean', short: 'h' }
    },
    allowPositionals: true
});

if (opts.help) {
    console.log('Usage: npm run dev -- [stack] [--profile <aws-profile>] [--region <aws-region>] [--api-url <url|stack>] [--pmtiles-url <url|stack>] [--no-dump] [--show-url]');
    console.log('');
    console.log(`  --api-url      API_URL written to api/.env-<stack>. Defaults to ${DEFAULT_API_URL}`);
    console.log('                 so locally generated URLs (basemap TileJSON, ESRI proxy) point at');
    console.log("                 the dev server. Pass 'stack' to use the deployed APIURL output.");
    console.log(`  --pmtiles-url  PMTILES_URL written to api/.env-<stack>. Defaults to ${DEFAULT_PMTILES_URL}`);
    console.log("                 (the local tile server). Pass 'stack' to use the deployed PMTilesAPI output.");
    console.log('  --no-dump      Skip the database dump/load and reuse the local tak_ps_etl database');
    console.log('  --show-url     Print the deployed database URL and exit without writing env files or loading a dump');
    process.exit(0);
}

if (positionals.length > 1) fail(`unexpected arguments: ${positionals.slice(1).join(' ')}`);

const stack = positionals[0] || DEFAULT_STACK;
const showUrl = !!opts['show-url'];

const deploy = JSON.parse(await fs.readFile(path.join(root, '.deploy'), 'utf8')) as {
    name: string;
    profile?: string;
    region?: string;
};

const fullStack = `${deploy.name}-${stack}`;
const staging = stack.includes('staging');

const region = opts.region
    || (staging ? 'us-east-1' : undefined)
    || process.env.AWS_REGION
    || deploy.region;

const profile = opts.profile
    || (staging ? 'coestaging' : undefined)
    || deploy.profile;

if (!region) fail(`no region for ${stack}: set .region in .deploy or pass --region`);
if (!profile) fail(`no profile for ${stack}: set .profile in .deploy or pass --profile`);

log(`Stack: ${stack}`);
log(`Profile: ${profile}`);
log(`Region: ${region}`);

const info = JSON.parse(await run('deploy', ['info', stack, '--profile', profile, '--region', region])) as {
    Outputs: Record<string, string>;
    Parameters: Record<string, string>;
};

const dbEndpoint = info.Outputs.DBEndpoint;
if (!dbEndpoint) fail(`${fullStack} has no DBEndpoint Output`);

const hostedApiUrl = info.Outputs.APIURL;
const hostedPmtilesUrl = info.Outputs.PMTilesAPI;

// Config.envInit() derives WEBHOOKS_URL from API_URL - pin it to the hosted value
// before API_URL is pointed at localhost so it survives the override.
const webhooksUrl = hostedApiUrl
    ? `https://webhooks.${new URL(hostedApiUrl).host.replace(/^map\./, '')}`
    : undefined;

const apiUrl = resolveUrl(opts['api-url'], DEFAULT_API_URL, hostedApiUrl, 'APIURL');
const pmtilesUrl = resolveUrl(opts['pmtiles-url'], DEFAULT_PMTILES_URL, hostedPmtilesUrl, 'PMTilesAPI');

log(`API_URL: ${apiUrl}`);
log(`PMTILES_URL: ${pmtilesUrl}`);

const dbSecret = JSON.parse(await secret(`${fullStack}/rds/secret`)) as { username: string; password: string };
const postgres = `postgresql://${dbSecret.username}:${dbSecret.password}@${dbEndpoint}:5432/tak_ps_etl`;

if (showUrl) {
    console.log(postgres);
    process.exit(0);
}

log(`Pulling secrets for ${fullStack} from AWS Secrets Manager`);

const signingSecret = await secret(`${fullStack}/api/secret`);
const geofenceSecret = await secret(`${fullStack}/api/geofence`).catch(() => '');

const assetBucket = (await run('aws', [
    'cloudformation', 'describe-stack-resource',
    '--stack-name', fullStack,
    '--logical-resource-id', 'AssetBucket',
    '--query', 'StackResourceDetail.PhysicalResourceId',
    '--output', 'text',
    '--profile', profile,
    '--region', region
])).trim();

// The deployed ECS container receives ECR_TASKS_REPOSITORY_NAME from CloudFormation
// as tak-vpc-<Environment>-cloudtak-tasks - derive the same value from the stack's
// Environment parameter so ECR-backed routes (Task versions/capabilities) work locally.
const ecsEnvironment = info.Parameters.Environment;

await writeEnv(path.join(apiDir, `.env-${stack}`), {
    SigningSecret: signingSecret,
    StackName: fullStack,
    ASSET_BUCKET: assetBucket,
    API_URL: apiUrl,
    PMTILES_URL: pmtilesUrl,
    WEBHOOKS_URL: webhooksUrl,
    CLOUDTAK_Config_geofence_password: geofenceSecret || undefined,
    ECR_TASKS_REPOSITORY_NAME: ecsEnvironment ? `tak-vpc-${ecsEnvironment}-cloudtak-tasks` : undefined
});

// StackName is deliberately omitted: the tile server treats it as a production
// flag that silences route logging
await writeEnv(path.join(pmtilesDir, `.env-${stack}`), {
    SigningSecret: signingSecret,
    ASSET_BUCKET: assetBucket,
    API_URL: LOCAL_API_URL,
    PMTILES_URL: pmtilesUrl
});

if (!opts['no-dump']) {
    const dump = `${stack}-latest.dump`;
    const bastion = `${stack}-bastion`;

    // Owners & grants reference roles that only exist on the deployed database
    ssh(bastion, `pg_dump --no-owner --no-privileges -d '${postgres}' > ${dump}`, `pg_dump on ${bastion} failed`);
    interactive('scp', [`${bastion}:~/${dump}`, '.'], apiDir, `scp from ${bastion} failed`);
    ssh(bastion, `rm ${dump}; exit`);

    const stat = await fs.stat(path.join(apiDir, dump)).catch(() => null);
    if (!stat || stat.size === 0) fail(`${dump} is missing or empty`);

    interactive('npm', ['run', 'loaddb', dump], apiDir, `failed to load ${dump} into tak_ps_etl - the local database was not updated`);

    log(`ok - loaded ${dump} into tak_ps_etl`);
}

// The AWS SDK in both servers reads the shell's default credentials - point
// them at the stack's profile & region unless the shell already set them.
// ELECTRON_RUN_AS_NODE leaks from IDE terminals and breaks native modules
const env: NodeJS.ProcessEnv = {
    ...process.env,
    AWS_PROFILE: process.env.AWS_PROFILE || profile,
    AWS_REGION: process.env.AWS_REGION || region
};
delete env.ELECTRON_RUN_AS_NODE;

const services = [
    service('api', apiDir, env),
    service('tiles', pmtilesDir, env)
];

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
        for (const child of services) stop(child, signal);
    });
}

function service(name: string, cwd: string, env: NodeJS.ProcessEnv): ChildProcess {
    // Each service gets its own process group so npm, tsx and the server it
    // forks can be stopped together
    const child = spawn('npm', ['run', 'dev', '--', '--env', stack], {
        cwd,
        env,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    prefix(child.stdout!, name, process.stdout);
    prefix(child.stderr!, name, process.stderr);

    child.on('exit', (code, signal) => {
        log(`not ok - ${name} exited (${signal || code})`);
        for (const other of services) {
            if (other !== child && other.exitCode === null) stop(other, 'SIGTERM');
        }
        process.exitCode = code || (signal ? 1 : 0);
    });

    return child;
}

function stop(child: ChildProcess, signal: NodeJS.Signals): void {
    if (!child.pid || child.exitCode !== null) return;

    try {
        process.kill(-child.pid, signal);
    } catch {
        child.kill(signal);
    }
}

function prefix(stream: NodeJS.ReadableStream, name: string, out: NodeJS.WritableStream): void {
    const tag = `[${name.padEnd(5)}] `;
    let rest = '';

    stream.setEncoding('utf8');
    stream.on('data', (chunk: string) => {
        const lines = (rest + chunk).split('\n');
        rest = lines.pop() || '';
        for (const line of lines) out.write(tag + line + '\n');
    });
    stream.on('end', () => {
        if (rest) out.write(tag + rest + '\n');
    });
}

function resolveUrl(override: string | undefined, fallback: string, hosted: string | undefined, output: string): string {
    if (override === 'stack') {
        if (!hosted) fail(`${fullStack} has no ${output} Output`);
        return hosted;
    }

    return override || fallback;
}

async function secret(id: string): Promise<string> {
    return (await run('aws', [
        'secretsmanager', 'get-secret-value',
        '--secret-id', id,
        '--query', 'SecretString',
        '--output', 'text',
        '--profile', profile!,
        '--region', region!
    ])).trim();
}

async function writeEnv(file: string, values: Record<string, string | undefined>): Promise<void> {
    const defined = Object.fromEntries(Object.entries(values).filter(([, v]) => v));
    await fs.writeFile(file, JSON.stringify(defined, null, 4) + '\n', { mode: 0o600 });
    log(`ok - wrote ${path.relative(root, file)}`);
}

async function run(cmd: string, args: string[]): Promise<string> {
    try {
        const { stdout } = await execFileAsync(cmd, args, { maxBuffer: 64 * 1024 * 1024 });
        return stdout;
    } catch (err) {
        const stderr = err && typeof err === 'object' && 'stderr' in err ? String(err.stderr).trim() : '';
        return fail(`${cmd} ${args[0]} failed${stderr ? `: ${stderr}` : ''}`);
    }
}

function ssh(host: string, command: string, error?: string): void {
    interactive('ssh', [host, '-t', command], apiDir, error);
}

function interactive(cmd: string, args: string[], cwd: string, error?: string): void {
    const res = spawnSync(cmd, args, { cwd, stdio: 'inherit' });

    if (res.status !== 0) {
        if (error) fail(error);
        log(`not ok - ${cmd} exited (${res.signal || res.status})`);
    }
}

// Progress output is suppressed under --show-url so the URL can be piped
function log(message: string): void {
    if (!showUrl) console.log(message);
}

function fail(message: string): never {
    console.error(`not ok - ${message}`);
    process.exit(1);
}
