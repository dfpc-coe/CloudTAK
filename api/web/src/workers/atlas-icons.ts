/*
 * AtlasIcons - Worker-thread façade for the iconset hydration logic.
 *
 * The actual logic (network IO, base64 -> Blob decoding, Dexie writes) lives
 * in `base/icon.ts` so it can be shared with non-worker callers. This class
 * just forwards calls and supplies the active auth token from the surrounding
 * `Atlas` instance.
 */

import Icon, { type IconHydrateResult } from '../base/icon.ts';
import type Atlas from './atlas.ts';

export type { IconHydrateResult };

export default class AtlasIcons {
    atlas: Atlas;

    constructor(atlas: Atlas) {
        this.atlas = atlas;
    }

    async hydrate(opts: { force?: boolean } = {}): Promise<IconHydrateResult> {
        return await Icon.hydrate({ token: this.atlas.token, force: opts.force });
    }

    async addIconset(uid: string): Promise<boolean> {
        return await Icon.addIconset(uid, { token: this.atlas.token });
    }

    async removeIconset(uid: string): Promise<boolean> {
        return await Icon.removeIconset(uid);
    }
}
