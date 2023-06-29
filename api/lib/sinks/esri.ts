import SinkInterface from '../sink.js';
// @ts-ignore
import ConnectionSink from '../types/connection-sink.js';
import Err from '@openaddresses/batch-error';
import EsriProxy from '../esri.js';
import Cacher from './cacher.js';

export default class ESRI extends SinkInterface {
    static sink_name(): string {
        return 'ArcGIS';
    }

    static async secrets(sink: ConnectionSink): Promise<any> {
        const secrets = await this.config.cacher.get(Cacher.Miss({}, `connection-${sink.connection}-sink-${sink.id}-secrets`), async () => {
            const esri = await EsriProxy.generateToken(
                new URL(req.body.url),
                config.API_URL,
                req.body.username,
                req.body.password
            );

            return {
                token: esri.token
            }
        });

        return secrets;
    }
}
