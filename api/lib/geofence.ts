import { Tile38 } from '@iwpnd/tile38-ts';
import type ConnectionConfig from './connection-config.js'
import CoT, { CoTParser } from '@tak-ps/node-cot';

export class GeofenceSever {
    tile38: Tile38;

    constructor(url: URL, password: string) {
        this.tile38 = new Tile38(
            url.port,
            url.hostname,
            { password }
        )

        this.tile38.on('error', (err: Error) => {
            console.error('not ok - Geofence Tile38 Connection Error:', err);
        });
    }

    /**
     * Send CoT events to Tile38
     *
     * @param connection Connection Config
     * @param cots Array of CoT events to send
     */
    async cots(
        connection: ConnectionConfig,
        cots: CoT[]
    ): Promise<void> {
        for (const cot of cots) {
            const feat = await CoTParser.to_geojson(cot);

            if (feat.geometry.type !== 'Point') continue;

            await this.tile38
                .set(connection.uid(), cot.uid())
                .object(feat)
                .ex(+new Date(feat.properties.stale))
                .exec();
        }
    }
}
