import EventEmitter from 'node:events';
import TAKAPI from './tak-api.js';
import { XML as COT } from '@tak-ps/node-cot';
import tls from 'tls';

export default class TAK extends EventEmitter {
    constructor(type, opts) {
        super();

        this.type = type;
        this.opts = opts;

        this.open = false;
        this.destroyed = false;

        this.client = null;

        this.version; // Server Version

        this.api = new TAKAPI(type, opts);
    }

    static async connect(url, auth) {
        if (!(url instanceof URL)) throw new Error('TAK Server URL not provided');

        const tak = new TAK('ssl', { url, auth });

        if (url.protocol === 'ssl:') {
            if (!tak.opts.auth.cert) throw new Error('auth.cert required');
            if (!tak.opts.auth.key) throw new Error('auth.key required');
            return await tak.connect_ssl(tak);
        } else {
            throw new Error('Unknown TAK Server Protocol');
        }
    }

    connect_ssl(tak) {
        if (!(tak.opts.url instanceof URL)) throw new Error('SSL url must be URL instance');
        if (typeof tak.opts.auth.cert !== 'string') throw new Error('Cert must be a String');
        if (typeof tak.opts.auth.key !== 'string') throw new Error('Key must be a String');

        return new Promise((resolve) => {
            tak.client = tls.connect({
                rejectUnauthorized: false,
                host: tak.opts.url.hostname,
                port: tak.opts.url.port,
                cert: tak.opts.auth.cert,
                key: tak.opts.auth.key
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

                let result = TAK.findCoT(buff);
                while (result && result.event) {
                    const cot = new COT(result.event);

                    try {
                        if (cot.raw.event._attributes.type === 't-x-c-t-r') {
                            tak.open = true;
                        } else if (cot.raw.event._attributes.type === 't-x-takp-v') {
                            tak.version = cot.raw.event.detail.TakControl.TakServerVersionInfo._attributes.serverVersion;
                        } else {
                            tak.emit('cot', cot);
                        }
                    } catch (e) {
                        console.error('Error parsing', e, data.toString());
                    }

                    buff = result.remainder;

                    result = TAK.findCoT(buff);
                }
            }).on('timeout', () => {
                if (!tak.destroyed) tak.emit('timeout');
            }).on('error', (err) => {
                tak.emit('error', err);
            }).on('end', () => {
                tak.open = false;
                tak.emit('end');
            });

            tak.ping();

            return resolve(tak);
        });
    }

    async reconnect() {
        return await tak.connect_ssl(tak);
    }

    destroy() {
        this.destroyed = true;
        tak.client.destroy();
    }

    async ping() {
        this.write(COT.ping());
    }

    /**
     * Write a COT to the TAK Connection
     *
     * @param {COT} cot COT Object
     */
    write(cot) {
        this.client.write(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${cot.to_xml()}`);
    }

    static findCoT(str) { // https://github.com/vidterra/multitak/blob/main/app/lib/helper.js#L4
        let match = str.match(/(<event.*?<\/event>)(.*)/); // find first COT
        if (!match) {
            match = str.match(/(<event[^>]*\/>)(.*)/); // find first COT
            if (!match) return null;
        }

        return {
            event: match[1],
            remainder: match[2],
            discard: match[0]
        };
    }
}
