import type Config from '../../../common/config.js';
import type { ArcGISConfig } from './arcgis-token-manager.js';

export function arcgisSettingKeys<S extends 'search' | 'routing'>(scope: S) {
    return [
        `${scope}::agol::enabled`,
        `${scope}::agol::auth_method`,
        `${scope}::agol::client_id`,
        `${scope}::agol::client_secret`,
        `${scope}::agol::token`,
    ] as const;
}

/**
 * Load the ArcGIS Online credentials of a provider, returning null if it is disabled or incomplete
 */
export default async function arcgisSettings(config: Config, scope: 'search' | 'routing'): Promise<ArcGISConfig | null> {
    const settings = await config.models.Setting.typedKeys([...arcgisSettingKeys(scope)]);

    if (!settings[`${scope}::agol::enabled`]) return null;

    if (settings[`${scope}::agol::auth_method`] === 'legacy') {
        const legacyToken = settings[`${scope}::agol::token`];
        if (!legacyToken) return null;

        return { authMethod: 'legacy', legacyToken };
    }

    const clientId = settings[`${scope}::agol::client_id`];
    const clientSecret = settings[`${scope}::agol::client_secret`];
    if (!clientId || !clientSecret) return null;

    return { authMethod: 'oauth2', clientId, clientSecret };
}
