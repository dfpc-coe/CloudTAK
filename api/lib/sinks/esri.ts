import SinkInterface from '../sink.ts';
// @ts-ignore
import ConnectionSink from '../types/connection-sink.ts';
import Err from '@openaddresses/batch-error';
import { EsriBase, EsriProxyPortal } from '../esri.ts';
import Cacher from '../cacher.ts';
import Config from '../config.ts';

export default class ESRI extends SinkInterface {
    static sink_name(): string {
        return 'ArcGIS';
    }

    static async secrets(config: Config, sink: ConnectionSink): Promise<any> {
        let secrets: any = {};
        do {
            secrets = await config.cacher.get(Cacher.Miss({}, `connection-${sink.connection}-sink-${sink.id}-secrets`), async () => {
                const esri = await EsriBase.from(new URL(sink.body.url), {
                    username: sink.body.username,
                    password: sink.body.password,
                    referer: config.API_URL,
                });

                return esri.token;
            });

            if (secrets.expires < +new Date()  + 1000 * 60 * 60) {
                await config.cacher.del(`connection-${sink.connection}-sink-${sink.id}-secrets`);
            }
        // Expire if less than an hour away
        } while (secrets.expires < +new Date()  + 1000 * 60 * 60)

        return secrets;
    }
}
