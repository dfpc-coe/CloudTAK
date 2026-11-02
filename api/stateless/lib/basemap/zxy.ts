import Err from '@openaddresses/batch-error';
import { BasemapProtocol } from '../interface-basemap.js';

/**
 * @class
 *
 * ZXY / Quadkey basemap protocol - standard slippy-map tile URLs
 * ({z}/{x}/{y} or {q} quadkey).
 */
export default class ZXYBasemap extends BasemapProtocol {
    isValidURL(str: string): void {
        super.isValidURL(str);

        // Consistent Mapbox Style XYZ Endpoints: {z} vs TAK: {$z}
        const pathname = decodeURIComponent(str).replace(/\{\$/g, '{');

        if (
            !(pathname.includes('{z}') && pathname.includes('{x}') && pathname.includes('{y}'))
            && !pathname.includes('{q}')
        ) {
            throw new Err(400, null, 'ZXY protocol requires {z}/{x}/{y} tile variables or a {q} quadkey variable');
        }
    }
}
