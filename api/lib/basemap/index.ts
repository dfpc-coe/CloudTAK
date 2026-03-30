import { Basemap_Protocol } from '../enums.js';
import { BasemapProtocol, TileJSONType, TileJSONActions, TileJSONInterface, VectorLayer } from '../interface-basemap.js';
import ZXYBasemap from './zxy.js';
import ImageServerBasemap from './imageserver.js';
import FeatureServerBasemap from './featureserver.js';
import MapServerBasemap from './mapserver.js';

/**
 * Return the protocol handler instance for the given protocol value.
 * Defaults to ZXY for unknown or undefined protocols.
 *
 * @param protocol - Value from the basemap `protocol` column
 */
export function fromProtocol(protocol?: string): BasemapProtocol {
    switch (protocol) {
        case Basemap_Protocol.ImageServer:  return new ImageServerBasemap();
        case Basemap_Protocol.FeatureServer: return new FeatureServerBasemap();
        case Basemap_Protocol.MapServer:    return new MapServerBasemap();
        default:                            return new ZXYBasemap();
    }
}

export {
    BasemapProtocol,
    TileJSONType,
    TileJSONActions,
    TileJSONInterface,
    VectorLayer,
    ZXYBasemap,
    ImageServerBasemap,
    FeatureServerBasemap,
    MapServerBasemap,
};
