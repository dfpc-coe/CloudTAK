import SinkInterface from '../sink.js';
// @ts-ignore
import ConnectionSink from '../types/connection-sink.js';
import Err from '@openaddresses/batch-error';
import EsriProxy from '../esri.js';
import Cacher from '../cacher.js';
import Config from '../config.js';

export default class ESRI extends SinkInterface {
    static sink_name(): string {
        return 'ArcGIS';
    }

    static async secrets(config: Config, sink: ConnectionSink): Promise<any> {
        const secrets = await config.cacher.get(Cacher.Miss({}, `connection-${sink.connection}-sink-${sink.id}-secrets`), async () => {
            const esri = await EsriProxy.generateToken(new URL(sink.body.url), config.API_URL, sink.body.username, sink.body.password);

            return { token: esri.token }
        });

        return secrets;
    }
}
