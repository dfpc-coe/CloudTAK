import Err from '@openaddresses/batch-error';
import type { BasemapConfig } from '../basemap.js';
import { BasemapProtocol } from './protocol.js';
import ZXYBasemap from './zxy.js';
import MapServerBasemap from './mapserver.js';
import ImageServerBasemap from './imageserver.js';
import FeatureServerBasemap from './featureserver.js';
import HostedBasemap from './hosted.js';

export function fromProtocol(basemap: BasemapConfig): BasemapProtocol {
    switch (basemap.protocol) {
        case 'zxy': return new ZXYBasemap(basemap);
        case 'mapserver': return new MapServerBasemap(basemap);
        case 'imageserver': return new ImageServerBasemap(basemap);
        case 'featureserver': return new FeatureServerBasemap(basemap);
        case 'hosted': return new HostedBasemap(basemap);
        default: throw new Err(400, null, `Unsupported basemap protocol: ${basemap.protocol}`);
    }
}
