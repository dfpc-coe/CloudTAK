import EventEmitter from 'events';
import { XML } from '@tak-ps/node-cot'
import * as p12 from 'p12-pem';
import path from 'path';
import tls from 'tls';

export default class TAK extends EventEmitter {
    constructor(type, opts) {
        super();

        this.type = type;
        this.opts = opts;
    }

    static async connect(url) {
        if (!(url instanceof URL)) throw new Error('TAK Server URL not provided');

        if (url.protocol === 'ssl:') {
            let cert = null;
            let key = null;

            if (process.env.TAK_P12 && process.env.TAK_P12_PASSWORD) {
                const certs = p12.getPemFromP12(new URL(path.resolve(process.env.TAK_P12), import.meta.url), process.env.TAK_P12_PASSWORD)

                cert = certs.pemCertificate
                    .split('-----BEGIN CERTIFICATE-----')
                    .join('-----BEGIN CERTIFICATE-----\n')
                    .split('-----END CERTIFICATE-----')
                    .join('\n-----END CERTIFICATE-----');
                key = certs.pemKey
                    .split('-----BEGIN RSA PRIVATE KEY-----')
                    .join('-----BEGIN RSA PRIVATE KEY-----\n')
                    .split('-----END RSA PRIVATE KEY-----')
                    .join('\n-----END RSA PRIVATE KEY-----');
            }

            return await this.connect_ssl(url, cert, key);
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
                host: url.hostname,
                port: url.port,
                cert,
                key
            });

            tak.client.on('connect', () => {
                console.log('connect', tak.client.authorized);
                console.log('connect', tak.client.authorizationError);
            });

            tak.client.on('secureConnect', () => {
                console.log('secure', tak.client.authorized);
                console.log('secure', tak.client.authorizationError);
            });

            let buff = '';
            tak.client.on('data', (data) => {
                // Eventually Parse ProtoBuf
                buff = buff + data.toString();

                let result = TAK.findCoT(buff)
                while (result && result.event) {
                    try {
                        const message = XML.xml2js(result.event);

                        if (message.event._attributes.type === 't-x-c-t-r') {
                            tak.client.write(TAK.cotPing())
                            break
                        } else {
                            tak.emit('msg', {
                                date: Date.now(),
                                source: {
                                    type: 'sslclient',
                                    ip: url
                                },
                                raw: result.event,
                                message
                            });
                        }
                    } catch(e) {
                        console.error('Error parsing', e, data.toString())
                    }

                    buff = result.remainder

                    result = TAK.findCoT(buff)
                }
            });

            tak.client.on('error', (err) => {
                console.error('TAK ERROR:', err);
                tak.emit('error', err);
            })

            tak.client.on('end', () => { tak.emit('end'); })

            return resolve(tak);
        });
    }

    write() {

    }

    processMsg(input) {
    }

    static cotPing() {
        const date = Date.now()
        return cot.js2xml({
            "event": {
                "_attributes": {
                    "version": "2.0",
                    "uid": "multitakPong",
                    "type": "t-x-c-t",
                    "how": "h-g-i-g-o",
                    "time": cot.jsDate2cot(date),
                    "start": cot.jsDate2cot(date),
                    "stale": cot.jsDate2cot(date + 20 * 1000), // 20 sec.
                },
                "point": {
                    "_attributes": {
                        "lat": "0.000000",
                        "lon": "0.000000",
                        "hae": "0.0",
                        "ce": "9999999.0",
                        "le": "9999999.0"
                    }
                }
            }
        })
    }

    static findCoT(str) { // https://github.com/vidterra/multitak/blob/main/app/lib/helper.js#L4
        let match = str.match(/(<event.*?<\/event>)(.*)/) // find first COT
        if (!match) {
            match = str.match(/(<event[^>]*\/>)(.*)/) // find first COT
            if(!match) return null
        }

        return {
            event: match[1],
            remainder: match[2],
            discard: match[0]
        }
    }
}
