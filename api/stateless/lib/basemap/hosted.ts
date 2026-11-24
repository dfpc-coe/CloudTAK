import Err from '@openaddresses/batch-error';
import { BasemapProtocol } from '../interface-basemap.js';

/**
 * @class
 *
 * Hosted PMTiles basemap protocol - a tileset served by the CloudTAK
 * tile server. URLs must point to a known tiles endpoint.
 */
export default class HostedBasemap extends BasemapProtocol {
    isValidURL(str: string): void {
        super.isValidURL(str);

        if (
            !(str.includes('{z}') && str.includes('{x}') && str.includes('{y}'))
            && !(str.includes('{$z}') && str.includes('{$x}') && str.includes('{$y}'))
        ) {
            throw new Err(400, null, 'Hosted protocol requires {z}/{x}/{y} tile variables');
        }
    }
}
