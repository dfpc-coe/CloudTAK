import path from 'node:path';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { sql, eq, or, inArray } from 'drizzle-orm';
import { GenericListOrder } from '@openaddresses/batch-generic';
import Config from '../../../common/config.js';
import S3 from '../../../common/aws/s3.js';
import {
    Basemap, BasemapVector, Profile, ProfileSession, ProfileSetting, ProfileFile, ProfileChatroom, ProfileChat,
    ProfileVideo, ProfileFeature, ProfileFusionSource, ProfileToken, ProfileInterest, ProfilePaging,
    ProfilePasskey, ProfilePasskeyChallenge, ProfileOverlay, VideoLease, Errors, Import, Iconset, Icon,
    CoreEvent, CoreDevice, CoreForm, CoreFormResponse, Connection, Layer, Data,
} from '../../../common/schema.js';
import { ProfileConfigDefaults } from './profile.js';
import VideoServiceControl from './video-service.js';
import { revokeSessions } from '../user/session.js';

export default class UserControl {
    config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    /**
     * Provision a new CloudTAK User - creating the underlying Profile,
     * per-user config defaults, and the default Basemap ProfileOverlay
     */
    async generate(
        input: InferInsertModel<typeof Profile>,
    ): Promise<InferSelectModel<typeof Profile>> {
        const profile = await this.config.models.Profile.generate(input);

        // Create a new ProfileConfig for each default setting.
        // For display settings (present in FullConfig) check for admin-configured system defaults;
        // for all other settings (tak::*, menu::*) use the ProfileConfigDefaults directly.
        const displayDefaults = {
            'display::stale': ProfileConfigDefaults['display::stale'],
            'display::distance': ProfileConfigDefaults['display::distance'],
            'display::elevation': ProfileConfigDefaults['display::elevation'],
            'display::speed': ProfileConfigDefaults['display::speed'],
            'display::projection': ProfileConfigDefaults['display::projection'],
            'display::zoom': ProfileConfigDefaults['display::zoom'],
            'display::style': ProfileConfigDefaults['display::style'],
            'display::coordinate': ProfileConfigDefaults['display::coordinate'],
            'display::text': ProfileConfigDefaults['display::text'],
            'display::icon_rotation': ProfileConfigDefaults['display::icon_rotation'],
            'display::radiation_dose': ProfileConfigDefaults['display::radiation_dose'],
        };

        const systemDisplayDefaults = await this.config.models.Setting.typedMany(displayDefaults);

        const configs: Array<Promise<unknown>> = [];

        for (const [key, value] of Object.entries(systemDisplayDefaults)) {
            configs.push(this.config.models.ProfileConfig.commit(profile.username, { [key]: value }));
        }

        for (const key of Object.keys(ProfileConfigDefaults) as (keyof typeof ProfileConfigDefaults)[]) {
            if (key in displayDefaults) continue;
            configs.push(this.config.models.ProfileConfig.commit(profile.username, {
                [key]: ProfileConfigDefaults[key],
            }));
        }

        await Promise.all(configs);

        await this.ensureDefaultBasemap(profile.username);
        await this.ensureDefaultTerrain(profile.username);

        return profile;
    }

    /**
     * Disable or re-enable a user - a disabled user retains their Profile and data
     * but can no longer authenticate and all of their login sessions are removed
     */
    async disable(username: string, disabled: boolean): Promise<InferSelectModel<typeof Profile>> {
        const profile = await this.config.models.Profile.commit(username, {
            disabled,
            updated: new Date().toISOString(),
        });

        if (disabled) await this.revokeSessions(username);

        return profile;
    }

    async revokeSessions(username: string): Promise<void> {
        const sessions = await this.config.pg.select({ id: ProfileSession.id })
            .from(ProfileSession)
            .where(eq(ProfileSession.username, username));

        await revokeSessions(this.config, sessions.map(session => session.id));
    }

    /**
     * Irreversibly erase a user and their personal data
     *
     * Everything the user owns is deleted - settings, credentials, files, chats, features,
     * overlays, video leases, imports, basemaps, iconsets and the CoreForms, CoreFormResponses,
     * CoreEvents & CoreDevices they authored - followed by the Profile itself. Connections,
     * Layers & Data Syncs are operational resources that are retained with their author cleared.
     *
     * Stored objects are removed before the database so that a failure part way through can
     * be resolved by erasing the user again.
     */
    async erase(username: string): Promise<void> {
        await this.disable(username, true);

        const leases = await this.config.models.VideoLease.list({
            limit: Number.MAX_SAFE_INTEGER,
            where: sql`username = ${username}`,
        });

        if (leases.items.length) {
            const videoControl = new VideoServiceControl(this.config);

            if ((await videoControl.settings()).configured) {
                for (const lease of leases.items) {
                    await videoControl.delete(lease.id, { username, admin: true });
                }
            }
        }

        const imports = await this.config.models.Import.list({
            limit: Number.MAX_SAFE_INTEGER,
            where: sql`username = ${username}`,
        });

        for (const imported of imports.items) {
            await S3.del(`import/${imported.id}${path.parse(imported.name).ext}`);
        }

        // Listing returns a single page of objects so the prefix is deleted until it is empty
        while ((await S3.list(`profile/${username}/`)).length) {
            await S3.del(`profile/${username}/`, { recurse: true });
        }

        await this.config.pg.transaction(async (tx) => {
            const iconsets = (await tx.select({ uid: Iconset.uid }).from(Iconset).where(eq(Iconset.username, username)))
                .map(iconset => iconset.uid);

            const owned = (await tx.select({ id: VideoLease.id }).from(VideoLease).where(eq(VideoLease.username, username)))
                .map(lease => lease.id);

            // Other users may have subscribed to a Lease owned by the erased user
            await tx.delete(ProfileVideo).where(owned.length
                ? or(eq(ProfileVideo.username, username), inArray(ProfileVideo.lease, owned))
                : eq(ProfileVideo.username, username));
            await tx.delete(VideoLease).where(eq(VideoLease.username, username));

            await tx.delete(ProfileOverlay).where(eq(ProfileOverlay.username, username));
            await tx.delete(ProfileFile).where(eq(ProfileFile.username, username));

            if (iconsets.length) {
                await tx.update(ProfileOverlay).set({ iconset: null }).where(inArray(ProfileOverlay.iconset, iconsets));
                await tx.update(ProfileFile).set({ iconset: null }).where(inArray(ProfileFile.iconset, iconsets));
                await tx.update(BasemapVector).set({ iconset: null }).where(inArray(BasemapVector.iconset, iconsets));
                await tx.delete(Icon).where(inArray(Icon.iconset, iconsets));
                await tx.delete(Iconset).where(eq(Iconset.username, username));
            }

            await tx.delete(Basemap).where(eq(Basemap.username, username));
            await tx.delete(Import).where(eq(Import.username, username));
            await tx.delete(Errors).where(eq(Errors.username, username));

            await tx.delete(ProfileChat).where(eq(ProfileChat.username, username));
            await tx.delete(ProfileChatroom).where(eq(ProfileChatroom.username, username));
            await tx.delete(ProfileFeature).where(eq(ProfileFeature.username, username));
            await tx.delete(ProfileFusionSource).where(eq(ProfileFusionSource.username, username));
            await tx.delete(ProfileToken).where(eq(ProfileToken.username, username));
            await tx.delete(ProfileInterest).where(eq(ProfileInterest.username, username));
            await tx.delete(ProfilePaging).where(eq(ProfilePaging.username, username));
            await tx.delete(ProfileSession).where(eq(ProfileSession.username, username));
            await tx.delete(ProfilePasskey).where(eq(ProfilePasskey.username, username));
            await tx.delete(ProfilePasskeyChallenge).where(eq(ProfilePasskeyChallenge.key, `reg:${username}`));
            await tx.delete(ProfileSetting).where(eq(ProfileSetting.username, username));

            await tx.delete(CoreFormResponse).where(eq(CoreFormResponse.username, username));
            await tx.delete(CoreForm).where(eq(CoreForm.username, username));
            await tx.delete(CoreDevice).where(eq(CoreDevice.username, username));
            await tx.delete(CoreEvent).where(eq(CoreEvent.username, username));

            await tx.update(Connection).set({ username: null }).where(eq(Connection.username, username));
            await tx.update(Layer).set({ username: null }).where(eq(Layer.username, username));
            await tx.update(Data).set({ username: null }).where(eq(Data.username, username));

            await tx.delete(Profile).where(eq(Profile.username, username));
        });
    }

    /**
     * Ensure the given user has a Basemap ProfileOverlay, creating one if necessary
     *
     * The admin configured default (`map::basemap`) is checked for existence and applied,
     * falling back to the first visible server raster Basemap. If no Basemap is
     * available this is a no-op.
     */
    async ensureDefaultBasemap(username: string): Promise<void> {
        const existing = await this.config.models.ProfileOverlay.count({
            where: sql`
                username = ${username}
                AND mode = 'basemap'
            `,
        });

        if (existing > 0) return;

        let basemap: (InferSelectModel<typeof Basemap> & { styles?: Array<unknown> }) | undefined = undefined;

        const configured = await this.config.models.Setting.typed('map::basemap', null);

        if (configured.value !== null) {
            try {
                const candidate = await this.config.models.Basemap.from(Number(configured.value));

                if (candidate.username || candidate.overlay || candidate.hidden) {
                    console.error(`Configured Default Basemap (map::basemap: ${configured.value}) is not a visible, non-overlay Server Basemap - falling back`);
                } else {
                    basemap = candidate;
                }
            } catch (err) {
                console.error(`Configured Default Basemap (map::basemap: ${configured.value}) could not be found - falling back`, err);
            }
        }

        if (!basemap) {
            const fallback = await this.config.models.Basemap.list({
                limit: 1,
                order: GenericListOrder.ASC,
                sort: 'name',
                where: sql`
                    username IS NULL
                    AND overlay = False
                    AND hidden = False
                    AND type = 'raster'
                `,
            });

            if (fallback.items.length) basemap = fallback.items[0];
        }

        if (!basemap) return;

        try {
            const overlay = await this.config.models.ProfileOverlay.generate({
                name: basemap.name,
                username,
                pos: -1,
                type: basemap.type,
                mode: 'basemap',
                mode_id: String(basemap.id),
                url: `/api/basemap/${basemap.id}/tiles`,
                frequency: basemap.frequency,
            });

            // Vector basemaps are unrenderable without their style layers - the
            // frontend fallback generates CoT styles bound to a source-layer that
            // won't exist in an arbitrary tileset. Persisted ProfileOverlay styles
            // are namespaced to the overlay (see Overlay.create in the frontend):
            // layer ids are prefixed with the overlay id and the source is the
            // overlay id, which is why this can't be set in the generate() above.
            const styles = (basemap.styles ?? []) as Array<Record<string, unknown>>;

            if (styles.length) {
                await this.config.models.ProfileOverlay.commit(overlay.id, {
                    styles: styles.map(layer => ({
                        ...layer,
                        id: `${overlay.id}-${layer.id}`,
                        source: String(overlay.id),
                    })),
                });
            }
        } catch (err) {
            // A concurrent login may have already provisioned the overlay - (username, url) is unique
            if (!String(err).includes('duplicate key value violates unique constraint')) throw err;
        }
    }

    /** Provision the admin default terrain (`map::terrain`) as a hidden raster-dem overlay */
    async ensureDefaultTerrain(username: string): Promise<void> {
        const configured = await this.config.models.Setting.typed('map::terrain', null);
        if (configured.value === null) return;

        const existing = await this.config.models.ProfileOverlay.count({
            where: sql`
                username = ${username}
                AND type = 'raster-dem'
            `,
        });

        if (existing > 0) return;

        let terrain: InferSelectModel<typeof Basemap>;
        try {
            terrain = await this.config.models.Basemap.from(Number(configured.value));
        } catch (err) {
            console.error(`Configured Default Terrain (map::terrain: ${configured.value}) could not be found`, err);
            return;
        }

        if (terrain.type !== 'raster-dem' || terrain.username) {
            console.error(`Configured Default Terrain (map::terrain: ${configured.value}) is not a raster-dem Server Basemap`);
            return;
        }

        try {
            await this.config.models.ProfileOverlay.generate({
                name: terrain.name,
                username,
                type: terrain.type,
                visible: false,
                mode: 'overlay',
                mode_id: String(terrain.id),
                url: `/api/basemap/${terrain.id}/tiles`,
                frequency: terrain.frequency,
            });
        } catch (err) {
            if (!String(err).includes('duplicate key value violates unique constraint')) throw err;
        }
    }
}
