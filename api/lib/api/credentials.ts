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
        const url = new URL(`/Marti/api/tls/signClient`, this.api.url);
        url.searchParams.append('clientUid', this.api.auth.username + ' (ETL)');

        const config = await xml2js.parseStringPromise(await this.config());

        let organization = null;
        let organizationUnit = null;
        for (const nameEntry of config['ns2:certificateConfig'].nameEntries) {
            for (const ne of nameEntry.nameEntry) {
                if (ne['$'].name === 'O') organization = ne['$'].value;
                if (ne['$'].name === 'OU') organizationUnit = ne['$'].value;
            }
        }

        //@ts-ignore The type defs don't have promisified
        const keys = await pem.promisified.createCSR({
            organization, organizationUnit
        });

        console.error(url);
        const res = await this.api.fetch(url, {
            method: 'POST',
            headers: {
                //Accept: 'application/json'
            },
            body: btoa(keys.csr)
        }, true);

        console.error('RESULT', res, res.headers);
    }
}
