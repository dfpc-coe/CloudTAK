import Err from '@openaddresses/batch-error';
import { BasemapProtocol } from '../interface-basemap.js';
import FeatureServerBasemap from './featureserver.js';

/**
 * @class
 *
 * ESRI MapServer basemap protocol.
 * MapServer layers expose the same query and tile delivery interface as
 * FeatureServer layers, so this class re-uses the FeatureServer implementation.
 */
export default class MapServerBasemap extends FeatureServerBasemap {
    isValidURL(str: string): void {
        // Bypass the FeatureServer pattern check — call base HTTP/S validation directly
        BasemapProtocol.prototype.isValidURL.call(this, str);

        if (!str.match(/\/MapServer\/\d+$/)) {
            throw new Err(400, null, 'MapServer protocol requires a URL ending with /MapServer/{id}');
        }
    }
}
