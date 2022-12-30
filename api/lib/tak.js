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
            return await tak.connect_ssl();
        } else {
            throw new Error('Unknown TAK Server Protocol');
        }
    }

    connect_ssl() {
        if (!(this.opts.url instanceof URL)) throw new Error('SSL url must be URL instance');
        if (typeof this.opts.auth.cert !== 'string') throw new Error('Cert must be a String');
        if (typeof this.opts.auth.key !== 'string') throw new Error('Key must be a String');

        return new Promise((resolve) => {
            this.client = tls.connect({
                rejectUnauthorized: false,
                host: this.opts.url.hostname,
                port: this.opts.url.port,
                cert: this.opts.auth.cert,
                key: this.opts.auth.key
            });

            this.client.on('connect', () => {
                console.log('connect', this.client.authorized);
                console.log('connect', this.client.authorizationError);
            });

            this.client.on('secureConnect', () => {
                console.log('secure', this.client.authorized);
                console.log('secure', this.client.authorizationError);
            });

            let buff = '';
            this.client.on('data', (data) => {
                // Eventually Parse ProtoBuf
                buff = buff + data.toString();

                let result = TAK.findCoT(buff);
                while (result && result.event) {
                    const cot = new COT(result.event);

                    try {
                        if (cot.raw.event._attributes.type === 't-x-c-t-r') {
                            this.open = true;
                        } else if (cot.raw.event._attributes.type === 't-x-takp-v') {
                            this.version = cot.raw.event.detail.TakControl.TakServerVersionInfo._attributes.serverVersion;
                        } else {
                            this.emit('cot', cot);
                        }
                    } catch (e) {
                        console.error('Error parsing', e, data.toString());
                    }

                    buff = result.remainder;

                    result = TAK.findCoT(buff);
                }
            }).on('timeout', () => {
                if (!this.destroyed) this.emit('timeout');
            }).on('error', (err) => {
                this.emit('error', err);
            }).on('end', () => {
                this.open = false;
                this.emit('end');
            });

            this.ping();

            return resolve(this);
        });
    }

    async reconnect() {
        return await this.connect_ssl();
    }

    destroy() {
        this.destroyed = true;
        this.client.destroy();
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
