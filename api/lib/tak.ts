import EventEmitter from 'node:events';
import tls from 'node:tls';
import CoT from '@tak-ps/node-cot';
import type { TLSSocket } from 'node:tls'

export interface TAKAuth {
    cert: string;
    key: string;
}

export interface PartialCoT {
    event: string;
    remainder: string;
    discard: string;
}

export default class TAK extends EventEmitter {
    id: number;
    type: string;
    url: URL;
    auth: TAKAuth;
    open: boolean;
    destroyed: boolean;
    client?: TLSSocket;
    queue: string[];
    writing: boolean;

    version: string;

    constructor(
        id: number,
        type: string,
        url: URL,
        auth: TAKAuth
    ) {
        super();

        this.id = id;

        this.type = type;
        this.url = url;
        this.auth = auth;

        this.open = false;
        this.destroyed = false;

        this.queue = [];

        this.version; // Server Version
    }

    static async connect(id: number, url: URL, auth: TAKAuth) {
        const tak = new TAK(id, 'ssl', url, auth);

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

            this.client.setNoDelay();

            this.client.on('connect', () => {
                console.error(`ok - ${this.id} @ connect:${this.client.authorized} - ${this.client.authorizationError}`);
            });

            this.client.on('secureConnect', () => {
                console.error(`ok - ${this.id} @ secure:${this.client.authorized} - ${this.client.authorizationError}`);
            });

            let buff = '';
            this.client.on('data', (data: Buffer) => {
                // Eventually Parse ProtoBuf
                buff = buff + data.toString();

                let result = TAK.findCoT(buff);
                while (result && result.event) {
                    const cot = new CoT(result.event);

                    try {
                        if (cot.raw.event._attributes.type === 't-x-c-t-r') {
                            this.open = true;
                            this.emit('ping');
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
                if (!this.destroyed) this.emit('end');
            });

            setInterval(() => {
                this.ping();
            }, 5000);

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
        this.write([CoT.ping()]);
    }

    writer(body: string): Promise<boolean> {
        return new Promise((resolve) => {
            const res: boolean = this.client.write(body + '\n', () => {
                return resolve(res)
            });
        });
    }

    async process() {
        this.writing = true;
        while (this.queue.length) {
            const body = this.queue.shift()
            await this.writer(body);
        }

        await this.writer('');

        if (this.queue.length) {
            process.nextTick(() => {
                this.process();
            });
        } else {
            this.writing = false;
        }
    }

    /**
     * Write a CoT to the TAK Connection
     *
     * @param {CoT} cot CoT Object
     */
    write(cots: CoT[]) {
        for (const cot of cots) {
            this.queue.push(cot.to_xml());
        }

        if (this.queue.length && !this.writing) this.process();
    }

    write_xml(body: string) {
        this.queue.push(body);

        if (this.queue.length && !this.writing) this.process();
    }

    // https://github.com/vidterra/multitak/blob/main/app/lib/helper.js#L4
    static findCoT(str: string): null | PartialCoT {
        str = str.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

        let match = str.match(/(<event.*?<\/event>)(.*)/); // find first CoT
        if (!match) {
            match = str.match(/(<event[^>]*\/>)(.*)/); // find first CoT
            if (!match) return null;
        }

        return {
            event: match[1],
            remainder: match[2],
            discard: match[0]
        };
    }
}
