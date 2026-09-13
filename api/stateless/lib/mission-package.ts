import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { Static } from '@sinclair/typebox';
import Err from '@openaddresses/batch-error';
import { CoTParser, DataPackage } from '@tak-ps/node-cot';
import type { Feature } from '@tak-ps/node-cot';
import type CoT from '@tak-ps/node-cot';
import type { TAKAPI } from '@tak-ps/node-tak';
import type { MissionOptions } from '@tak-ps/node-tak/lib/api/mission';
import S3 from '../../common/aws/s3.js';
import stream2buffer from './stream.js';

// TAK Server hands package CoTs to its async messaging pipeline before responding,
// so mission membership is only visible on a subsequent read of the mission
const CONFIRM_DELAYS_MS = [0, 250, 500, 1000, 2000];

export type MissionAttachment = {
    name: string;
    body: Buffer;
    uid: string;
};

export type ResolvedFeatures = {
    cots: CoT[];
    attachments: MissionAttachment[];
};

/**
 * Parse Features into CoTs and fetch the attachments they reference from S3
 */
export async function resolveFeatures(
    features: Array<Static<typeof Feature.InputFeature>>,
): Promise<ResolvedFeatures> {
    const cots: CoT[] = [];

    // Hash => CoT UID
    const attachmentMap: Map<string, string> = new Map();

    for (const feat of features) {
        const cot = await CoTParser.from_geojson(feat);
        cots.push(cot);

        for (const hash of feat.properties.attachments || []) {
            attachmentMap.set(hash, cot.uid());
        }
    }

    const attachments: MissionAttachment[] = [];

    for (const [hash, uid] of attachmentMap) {
        const attachment = await S3.list(`attachment/${hash}/`);
        if (attachment.length < 1 || !attachment[0].Key) continue;

        attachments.push({
            uid,
            name: path.parse(attachment[0].Key).base,
            body: await stream2buffer(await S3.get(attachment[0].Key)),
        });
    }

    return { cots, attachments };
}

/**
 * A CoT-only Data Package destined for a Mission
 *
 * TAK Server ignores the package manifest when adding a package to a Mission and
 * TAK clients resolve attachments via the sha256 hashes in the CoT's attachment_list,
 * so attachments are uploaded and attached to the Mission directly, before the CoTs
 */
export default class MissionPackage {
    pkg: DataPackage;
    cots: CoT[];
    attachments: MissionAttachment[];
    username: string;

    #finalized?: string;
    #hashes?: string[];

    private constructor(pkg: DataPackage, resolved: ResolvedFeatures, username: string) {
        this.pkg = pkg;
        this.username = username;
        this.cots = resolved.cots;
        this.attachments = resolved.attachments;
    }

    static async from(
        resolved: ResolvedFeatures,
        opts: {
            username: string;
            name?: string;
        },
    ): Promise<MissionPackage> {
        const id = crypto.randomUUID();
        const pkg = new DataPackage(id, opts.name || id);
        pkg.setEphemeral();

        try {
            for (const cot of resolved.cots) {
                await pkg.addCoT(cot);
            }
        } catch (err) {
            await pkg.destroy();
            throw err;
        }

        return new MissionPackage(pkg, resolved, opts.username);
    }

    get uids(): string[] {
        return this.cots.map(cot => cot.uid());
    }

    /**
     * Upload the package to a Mission
     *
     * The submitting user must hold a Mission subscription as ANDROID-CloudTAK-<username>
     * with MISSION_WRITE - TAK Server silently drops package CoTs otherwise
     */
    async upload(
        api: TAKAPI,
        guid: string,
        opts: Static<typeof MissionOptions>,
    ): Promise<void> {
        if (!this.#hashes) {
            const hashes: string[] = [];
            for (const attachment of this.attachments) {
                const uploaded = await api.Files.upload({
                    name: attachment.name,
                    contentLength: attachment.body.length,
                    keywords: [],
                    creatorUid: this.username,
                }, attachment.body);

                hashes.push(uploaded.Hash);
            }
            this.#hashes = hashes;
        }

        if (this.#hashes.length) {
            await api.Mission.attachContents(guid, { hashes: this.#hashes }, opts);
        }

        if (!this.#finalized) this.#finalized = await this.pkg.finalize();

        // A non-empty response body lists conflicts and arrives with a 409, which node-tak throws
        await api.Mission.upload(
            guid,
            `ANDROID-CloudTAK-${this.username}`,
            fs.createReadStream(this.#finalized),
            opts,
        );
    }

    /**
     * Poll the Mission until every CoT in the package is listed
     *
     * @returns The UIDs of the CoTs confirmed by the TAK Server
     */
    async confirm(
        api: TAKAPI,
        guid: string,
        opts: Static<typeof MissionOptions>,
    ): Promise<string[]> {
        let missing = this.uids;

        for (const wait of CONFIRM_DELAYS_MS) {
            if (!missing.length) break;
            if (wait) await delay(wait);

            const mission = await api.Mission.get(guid, {}, opts);
            const confirmed = new Set(mission.uids.map(entry => (entry as { data?: unknown }).data));

            missing = missing.filter(uid => !confirmed.has(uid));
        }

        if (missing.length) {
            throw new Err(502, null, `TAK Server did not confirm CoT: ${missing.join(', ')}`);
        }

        return this.uids;
    }

    async destroy(): Promise<void> {
        await this.pkg.destroy();
    }
}
