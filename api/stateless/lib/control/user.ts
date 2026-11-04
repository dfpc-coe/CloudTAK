import path from 'node:path';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { sql, eq, or, inArray } from 'drizzle-orm';
import Config from '../../../common/config.js';
import S3 from '../../../common/aws/s3.js';
import {
    Basemap, BasemapVector, Profile, ProfileSession, ProfileSetting, ProfileFile, ProfileChatroom, ProfileChat,
    ProfileVideo, ProfileFeature, ProfileFusionSource, ProfileToken, ProfileInterest, ProfilePaging,
    ProfilePasskey, ProfilePasskeyChallenge, VideoLease, Errors, Import, Iconset, Icon,
    CoreEntity, CoreForm, CoreFormResponse, Connection, Layer, Data,
} from '../../../common/schema.js';
import { ProfileConfigDefaults } from './profile.js';
import VideoServiceControl from './video-service.js';
import ProfileOverlayControl from '../../../common/control/profile-overlay.js';
import { revokeSessions } from '../user/session.js';

export default class UserControl {
    config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    /**
     * Provision a new CloudTAK User - creating the underlying Profile,
     * per-user config defaults, and the default Basemap overlay
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
            'display::area': ProfileConfigDefaults['display::area'],
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

        const overlayControl = new ProfileOverlayControl(this.config);
        await overlayControl.ensureDefaultBasemap(profile.username);
        await overlayControl.ensureDefaultTerrain(profile.username);

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
     * CoreEntities & CoreDevices they authored - followed by the Profile itself. Connections,
     * Layers & Data Syncs are operational resources that are retained with their author cleared.
     *
     * Stored objects are removed before the database so that a failure part way through can
     * be resolved by erasing the user again.
     */
    async erase(username: string): Promise<void> {
        await this.disable(username, true);
        const overlayControl = new ProfileOverlayControl(this.config);

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

            await overlayControl.eraseUser(username, tx);
            await tx.delete(ProfileFile).where(eq(ProfileFile.username, username));

            if (iconsets.length) {
                await overlayControl.detachIconsets(iconsets, tx);
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
            await tx.delete(CoreEntity).where(eq(CoreEntity.username, username));

            await tx.update(Connection).set({ username: null }).where(eq(Connection.username, username));
            await tx.update(Layer).set({ username: null }).where(eq(Layer.username, username));
            await tx.update(Data).set({ username: null }).where(eq(Data.username, username));

            await tx.delete(Profile).where(eq(Profile.username, username));
        });
    }
}
