import SinkInterface from '../sink.js';
import { ConnectionSink } from '../schema.js';
import { type InferSelectModel } from 'drizzle-orm';
import { EsriBase } from '../esri.js';
import Cacher from '../cacher.js';
import Config from '../config.js';

export default class ESRI extends SinkInterface {
    static sink_name(): string {
        return 'ArcGIS';
    }

    static async secrets(config: Config, sink: InferSelectModel<typeof ConnectionSink>): Promise<any> {
        let secrets: Record<string, string | number> = {};
        do {
            secrets = await config.cacher.get(Cacher.Miss({}, `connection-${sink.connection}-sink-${sink.id}-secrets`), async () => {
                const body: any = sink.body;
                const esri = await EsriBase.from(new URL(body.url), {
                    username: body.username,
                    password: body.password,
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
