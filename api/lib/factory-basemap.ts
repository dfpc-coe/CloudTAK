import { InferSelectModel } from 'drizzle-orm';
import { Basemap_Protocol } from './enums.js';
import { BasemapProtocol } from './interface-basemap.js';
import { Basemap } from './schema.js';
import ZXYBasemap from './basemap/zxy.js';
import HostedBasemap from './basemap/hosted.js';
import ImageServerBasemap from './basemap/imageserver.js';
import FeatureServerBasemap from './basemap/featureserver.js';
import MapServerBasemap from './basemap/mapserver.js';

/**
 * Return the protocol handler instance for the given protocol value.
 * Defaults to ZXY for unknown or undefined protocols.
 *
 * @param protocol - Value from the basemap `protocol` column
 */
export function fromProtocol(protocol?: string, basemap?: InferSelectModel<typeof Basemap>): BasemapProtocol {
    if (protocol === Basemap_Protocol.ImageServer) {
        return new ImageServerBasemap(basemap);
    } else if (protocol === Basemap_Protocol.FeatureServer) {
        return new FeatureServerBasemap(basemap);
    } else if (protocol === Basemap_Protocol.MapServer) {
        return new MapServerBasemap(basemap);
    } else if (protocol === Basemap_Protocol.Hosted) {
        return new HostedBasemap(basemap);
    } else {
        return new ZXYBasemap(basemap);
    }
}


