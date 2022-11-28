import EventEmitter from 'events';
import * as p12 from 'p12-pem';
import path from 'path';
import tls from 'tls';

export default class TAK extends EventEmitter {
    constructor(type, opts) {
        super();

        this.type = type;
        this.opts = opts;

        if (type === 'ssl') {

        } else {
            throw new Error('Unknown Connection Type');
        }
    }

    static async connect(url) {
        if (!(url instanceof URL)) throw new Error('TAK Server URL not provided');

        if (url.protocol === 'ssl:') {
            let cert = null;
            let key = null;

            if (process.env.TAK_P12 && process.env.TAK_P12_PASSWORD) {
                const certs = p12.getPemFromP12(new URL(path.resolve(process.env.TAK_P12), import.meta.url), process.env.TAK_P12_PASSWORD)

                cert = certs.pemCertificate;
                key = certs.pemKey;
            }

            await this.connect_ssl(url, cert, key);
        } else {
            throw new Error('Unknown TAK Server Protocol');
        }
    }

    static connect_ssl(url, cert, key) {
        if (!(url instanceof URL)) throw new Error('SSL url must be URL instance');
        if (typeof cert !== 'string') throw new Error('Cert must be a String');
        if (typeof key !== 'string') throw new Error('Key must be a String');

        const tak = new TAK('ssl', { url, cert, key });

        return new Promise((resolve, reject) => {
            tak.client = tls.connect({
                rejectUnauthorized: false,
                host: url.host,
                port: url.port,
                cert,
                key
            }, () => {
                if (!tak.client.authorized) throw tak.client.authorizationError;
            });

            let buff;
            tak.client.on('data', (data) => {
                // Eventually Parse ProtoBuf
                data = buff + data.toString();
            });

            tak.client.on('error', (err) => { tak.emit('error', err); })
            tak.client.on('close', () => { tak.emit('close'); })

            return resolve(tak);
        });
    }

    write() {

    }
}
