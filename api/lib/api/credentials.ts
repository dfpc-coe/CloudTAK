import TAKAPI from '../tak-api.js';
import pem from 'pem';
import xml2js from 'xml2js';

export default class {
    api: TAKAPI;

    constructor(api: TAKAPI) {
        this.api = api;
    }

    async config() {
        const url = new URL(`/Marti/api/tls/config`, this.api.url);
        return await this.api.fetch(url, {
            method: 'GET'
        });
    }

    async generate() {
        const url = new URL(`/Marti/api/tls/signClient/v2`, this.api.url);
        url.searchParams.append('clientUid', this.api.auth.username + ' (ETL)');

        const config = xml2js.parseStringPromise(await this.config());

        console.error(config);

        //@ts-ignore The type defs don't have promisified
        const keys = await pem.promisified.createCertificate({ days: 356, selfSigned: true });

        const res = await this.api.fetch(url, {
            method: 'POST',
            body: keys.csr
        });

        //console.error(res);
    }
}
