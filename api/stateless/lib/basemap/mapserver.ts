import Err from '@openaddresses/batch-error';
import type { Static } from '@sinclair/typebox';
import { Basemap_Type } from '../../../common/enums.js';
import { BasemapProtocol, TileJSONActions } from '../interface-basemap.js';
import FeatureServerBasemap from './featureserver.js';

/**
 * @class
 *
 * ESRI MapServer basemap protocol.
 * MapServer layers can expose either vector feature data or raster imagery.
 * The service type is discovered at basemap creation time (POST /basemap) and
 * persisted as the basemap's `type` field - only vector layers support
 * feature actions.
 */
export default class MapServerBasemap extends FeatureServerBasemap {
    isValidURL(str: string): void {
        // Bypass the FeatureServer pattern check — call base HTTP/S validation directly
        BasemapProtocol.prototype.isValidURL.call(this, str);

        if (!str.match(/\/MapServer\/\d+$/)) {
            throw new Err(400, null, 'MapServer protocol requires a URL ending with /MapServer/{id}');
        }
    }

    /**
     * Return the feature actions supported by this layer.
     * Raster MapServer layers do not support feature querying or fetching.
     */
    actions(): Static<typeof TileJSONActions> {
        if (this.basemap?.type === Basemap_Type.VECTOR) {
            return super.actions();
        }

        return { feature: [] };
    }
}
