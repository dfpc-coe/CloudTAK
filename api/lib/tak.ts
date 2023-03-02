import EventEmitter from 'node:events';
import tls from 'node:tls';
import TAKAPI from './tak-api.js';
import { XML as COT } from '@tak-ps/node-cot';

export interface TAKAuth {
    cert: string;
    key: string;
}

export default class TAK extends EventEmitter {
    type: string;
    url: URL;
    auth: TAKAuth;
    open: boolean;
    destroyed: boolean;
    client: any;
    version: string;
    api: TAKAPI;

    constructor(type: string, url: URL, auth: TAKAuth) {
        super();

        this.type = type;
        this.url = url;
        this.auth = auth;

        this.open = false;
        this.destroyed = false;

        this.client = null;

        this.version; // Server Version

        this.api = new TAKAPI(type, url, auth);
    }

    static async connect(url: URL, auth: TAKAuth) {
        const tak = new TAK('ssl', url, auth);

        if (url.protocol === 'ssl:') {
            if (!tak.auth.cert) throw new Error('auth.cert required');
            if (!tak.auth.key) throw new Error('auth.key required');
            return await tak.connect_ssl();
        } else {
            throw new Error('Unknown TAK Server Protocol');
        }
    }

    connect_ssl(): Promise<TAK> {
        return new Promise((resolve) => {
            this.client = tls.connect({
                host: this.url.hostname,
                port: parseInt(this.url.port),
                rejectUnauthorized: false,
                cert: this.auth.cert,
                key: this.auth.key
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
            this.client.on('data', (data: Buffer) => {
                // Eventually Parse ProtoBuf
                buff = buff + data.toString();

                let result: any = TAK.findCoT(buff);
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
            }).on('error', (err: Error) => {
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
    write(cot: COT) {
        this.client.write(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${cot.to_xml()}`);
    }

    static findCoT(str: string): object { // https://github.com/vidterra/multitak/blob/main/app/lib/helper.js#L4
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
