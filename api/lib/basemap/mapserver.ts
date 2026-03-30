import FeatureServerBasemap from './featureserver.js';

/**
 * @class
 *
 * ESRI MapServer basemap protocol.
 * MapServer layers expose the same query and tile delivery interface as
 * FeatureServer layers, so this class re-uses the FeatureServer implementation.
 */
export default class MapServerBasemap extends FeatureServerBasemap {}
