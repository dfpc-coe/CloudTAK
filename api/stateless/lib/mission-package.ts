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
const CONFIRM_ATTEMPTS = 5;
const CONFIRM_DELAY_MS = 300;

export type MissionAttachment = {
    name: string;
    body: Buffer;
    uid: string;
};

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
    uids: string[];
    attachments: MissionAttachment[];
    username: string;

    #finalized?: string;
    #hashes?: string[];

    private constructor(pkg: DataPackage, username: string) {
        this.pkg = pkg;
        this.username = username;
        this.cots = [];
        this.uids = [];
        this.attachments = [];
    }

    static async from(
        features: Array<Static<typeof Feature.InputFeature>>,
        opts: {
            username: string;
            name?: string;
        },
    ): Promise<MissionPackage> {
        const id = crypto.randomUUID();
        const pkg = new DataPackage(id, opts.name || id);
        pkg.setEphemeral();

        const missionPkg = new MissionPackage(pkg, opts.username);

        // Hash => CoT UID
        const attachmentMap: Map<string, string> = new Map();

        for (const feat of features) {
            const cot = await CoTParser.from_geojson(feat);
            await pkg.addCoT(cot);
            missionPkg.cots.push(cot);
            missionPkg.uids.push(cot.uid());

            for (const hash of feat.properties.attachments || []) {
                attachmentMap.set(hash, cot.uid());
            }
        }

        for (const [hash, uid] of attachmentMap) {
            const attachment = await S3.list(`attachment/${hash}/`);
            if (attachment.length < 1 || !attachment[0].Key) continue;

            missionPkg.attachments.push({
                uid,
                name: path.parse(attachment[0].Key).base,
                body: await stream2buffer(await S3.get(attachment[0].Key)),
            });
        }

        return missionPkg;
    }

    /**
     * Upload the package to a Mission and confirm every CoT is now part of it
     *
     * The submitting user must hold a Mission subscription as ANDROID-CloudTAK-<username>
     * with MISSION_WRITE - TAK Server silently drops package CoTs otherwise
     *
     * @returns The UIDs of the CoTs confirmed by the TAK Server
     */
    async upload(
        api: TAKAPI,
        guid: string,
        opts: Static<typeof MissionOptions>,
    ): Promise<string[]> {
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

        let missing = this.uids;
        for (let attempt = 0; attempt < CONFIRM_ATTEMPTS && missing.length; attempt++) {
            if (attempt > 0) await delay(CONFIRM_DELAY_MS);

            const mission = await api.Mission.get(guid, {}, opts) as { uids?: unknown[] };

            const confirmed = new Set<string>();
            for (const entry of mission.uids || []) {
                if (typeof entry === 'string') {
                    confirmed.add(entry);
                } else if (entry && typeof entry === 'object' && typeof (entry as { data?: unknown }).data === 'string') {
                    confirmed.add((entry as { data: string }).data);
                }
            }

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
