import EventEmitter from 'events';
import { XML as COT } from '@tak-ps/node-cot'
import path from 'path';
import tls from 'tls';

export default class TAK extends EventEmitter {
    constructor(type, opts) {
        super();

        this.type = type;
        this.opts = opts;
        this.open = false;

        this.version; // Server Version
    }

    static async connect(url, auth) {
        if (!(url instanceof URL)) throw new Error('TAK Server URL not provided');

        if (url.protocol === 'ssl:') {
            if (!auth.cert) throw new Error('auth.cert required');
            if (!auth.key) throw new Error('auth.key required');
            return await this.connect_ssl(url, auth.cert, auth.key);
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
                    const cot = new COT(result.event);

                    try {
                        if (cot.raw.event._attributes.type === 't-x-c-t-r') {
                            tak.open = true;
                        } else if (cot.raw.event._attributes.type === 't-x-takp-v') {
                            tak.version = cot.raw.event.detail.TakControl.TakServerVersionInfo._attributes.serverVersion;
                        } else {
                            tak.emit('cot', cot)
                        }
                    } catch(e) {
                        console.error('Error parsing', e, data.toString())
                    }

                    buff = result.remainder

                    result = TAK.findCoT(buff)
                }
            });

            tak.client.on('error', (err) => { tak.emit('error', err); })
            tak.client.on('end', () => { tak.emit('end'); })

            tak.ping();

            return resolve(tak);
        });
    }

    async ping() {
        this.write(COT.ping());
    }

    /**
     * Write a COT to the TAK Connection
     */
    write(cot) {
        console.error(`writing:${cot.raw.event._attributes.type}`);
        console.error(cot.to_xml());
        this.client.write(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${cot.to_xml()}`)
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
