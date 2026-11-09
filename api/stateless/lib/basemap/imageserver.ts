import Err from '@openaddresses/batch-error';
import { BasemapProtocol } from '../interface-basemap.js';

/**
 * @class
 *
 * ESRI ImageServer basemap protocol - raster imagery from an ArcGIS
 * ImageServer.
 */
export default class ImageServerBasemap extends BasemapProtocol {
    isValidURL(str: string): void {
        super.isValidURL(str);

        if (!str.includes('/ImageServer')) {
            throw new Err(400, null, 'ImageServer protocol requires a URL ending with /ImageServer');
        }
    }
}
