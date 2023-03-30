import CP from 'child_process';
import stream from 'stream';

/**
 * Create a new Tippecanoe instance
 *
 * @class
 */
export default class Tippecanoe {
    constructor() {
        try {
            CP.execSync('tippecanoe --version 2>&1');
            CP.execSync('which tile-join');
        } catch (err) {
            throw new Error('tippecanoe not installed');
        }
    }

    /**
     * Generate a Mapbox Vector Tileset given a line delimited stream of GeoJSON features
     *
     * @param {Stream} feats Stream of GeoJSON features to vectorize
     * @param {String} output_path Path to write mbtiles to
     * @param {Object} options Optional Options
     * @param {boolean} options.std Don't squelch tippecanoe stderr/stdout [default: false]
     * @param {String} options.name Human-readable name for the tileset
     * @param {String} options.attribution Attribution (HTML) to be shown with maps that use data from this tileset
     * @param {String} options.description Description for the tileset
     * @param {String} options.layer Layer name to put the data to [Default: out]
     * @param {Object} options.zoom Zoom Options
     * @param {Number} options.zoom.max Max zoom of tiles
     * @param {Number} options.zoom.min Min zoom of tiles
     * @param {Boolean} options.force Delete the mbtiles file if it already exists instead of giving an error
     * @param {Object} options.limit Limit Options
     * @param {Boolean} [options.limit.features=true] Limit tiles to 200,000 features
     * @param {Boolean} [options.limit.size=true] Limit tiles to 500K bytes
     *
     * @returns {Promise} true if the vectorization succeeds
     */
    tile(feats, output_path, options = {}) {
        return new Promise((resolve, reject) => {
            if (!feats) return reject(new Error('feats required'));
            if (!output_path) return reject(new Error('output_path required'));

            if (!options.zoom) options.zoom = {};
            if (!options.limit) options.limit = {};

            let base = [
                '-o', output_path
            ];

            base = base.concat(['-l', options.layer || 'out']);

            if (options.force) base = base.concat(['-f']);
            if (options.name) base = base.concat(['-n', `"${options.name}"`]);
            if (options.attribution) base = base.concat(['-A', `"${options.attribution}"`]);
            if (options.description) base = base.concat(['-N', `"${options.description}"`]);
            if (options.zoom.max) base = base.concat(['--maximum-zoom', options.zoom.max]);
            if (options.zoom.min) base = base.concat(['--minimum-zoom', options.zoom.min]);
            if (options.limit.features === false) base.concat(['--no-feature-limit']);
            if (options.limit.size === false) base.concat(['--no-tile-size-limit']);

            const tippecanoe = CP.spawn('tippecanoe', base, {
                env: process.env
            })
                .on('error', reject)
                .on('close', resolve);

            if (options.std) {
                tippecanoe.stdout.pipe(process.stdout);
                tippecanoe.stderr.pipe(process.stderr);
            }

            stream.pipeline(
                feats,
                tippecanoe.stdin, (err) => {
                    if (err) return reject(err);
                });
        });
    }

    /**
     * Join multiple MBTiles into a single MBTiles
     *
     * @param {String} output_path Path to input MBTiles
     * @param {String[]} inputs Array of paths to input MBTiles
     * @param {Object} options Optional Options
     * @param {boolean} options.std Don't squelch tippecanoe stderr/stdout [default: false]
     * @param {Boolean} options.force Delete the mbtiles file if it already exists instead of giving an error
     * @param {Object} options.limit Limit Options
     * @param {Boolean} [options.limit.features=true] Limit tiles to 200,000 features
     * @param {Boolean} [options.limit.size=true] Limit tiles to 500K bytes
     *
     * @returns {Promise}
     */
    join(output_path, inputs, options = {}) {
        return new Promise((resolve, reject) => {
            if (!output_path) return reject(new Error('output_path required'));
            if (!inputs || !inputs.length) return reject(new Error('inputs required'));

            let base = [
                '-o', output_path
            ].concat(inputs);

            if (options.force) base = base.concat(['-f']);
            if (options.limit.features === false) base.concat(['--no-feature-limit']);
            if (options.limit.size === false) base.concat(['--no-tile-size-limit']);

            const tilejoin = CP.spawn('tile-join', base, {
                env: process.env
            })
                .on('error', reject)
                .on('close', resolve);

            if (options.std) {
                tilejoin.stdout.pipe(process.stdout);
                tilejoin.stderr.pipe(process.stderr);
            }
        });
    }
}
