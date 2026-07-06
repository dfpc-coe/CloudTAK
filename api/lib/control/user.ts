import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { GenericListOrder } from '@openaddresses/batch-generic';
import Config from '../config.js';
import { Basemap, Profile } from '../schema.js';
import { ProfileConfigDefaults } from './profile.js';

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

        return profile;
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

        let basemap: InferSelectModel<typeof Basemap> | undefined = undefined;

        const configured = await this.config.models.Setting.typed('map::basemap', null);

        if (configured.value !== null) {
            try {
                basemap = await this.config.models.Basemap.from(Number(configured.value));
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
                    (username IS NULL OR username = ${username})
                    AND overlay = False
                    AND hidden = False
                    AND type = 'raster'
                `,
            });

            if (fallback.items.length) basemap = fallback.items[0];
        }

        if (!basemap) return;

        try {
            await this.config.models.ProfileOverlay.generate({
                name: basemap.name,
                username,
                pos: -1,
                type: basemap.type,
                mode: 'basemap',
                mode_id: String(basemap.id),
                url: `/api/basemap/${basemap.id}/tiles`,
            });
        } catch (err) {
            // A concurrent login may have already provisioned the overlay - (username, url) is unique
            if (!String(err).includes('duplicate key value violates unique constraint')) throw err;
        }
    }
}
