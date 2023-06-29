import SinkInterface from '../sink.js';
// @ts-ignore
import ConnectionSink from '../types/connection-sink.js';
import Err from '@openaddresses/batch-error';
import EsriProxy from '../esri.js';

export default class ESRI extends SinkInterface {
    static sink_name(): string {
        return 'ArcGIS';
    }

    static async secrets(sink: ConnectionSink): Promise<any> {

    }
}
