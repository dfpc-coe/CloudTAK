import TAKAPI, {
    APIAuthPassword
} from '../tak-api.js';
import { Static, Type } from '@sinclair/typebox';
import pem from 'pem';
import xml2js from 'xml2js';

export const CertificateResponse = Type.Object({
    cert: Type.String(),
    key: Type.String()
});

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

    async generate(): Promise<Static<typeof CertificateResponse>> {
        if (!(this.api.auth instanceof APIAuthPassword)) throw new Error('Must use Password Auth');

        const config = await xml2js.parseStringPromise(await this.config());

        let organization = null;
        let organizationUnit = null;
        for (const nameEntry of config['ns2:certificateConfig'].nameEntries) {
            for (const ne of nameEntry.nameEntry) {
                if (ne['$'].name === 'O') organization = ne['$'].value;
                if (ne['$'].name === 'OU') organizationUnit = ne['$'].value;
            }
        }

        const createCSR = pem.promisified.createCSR;

        const keys: {
            csr: string,
            clientKey: string
        } = await createCSR({
            organization,
            organizationUnit,
            commonName: this.api.auth.username
        });

        const url = new URL(`/Marti/api/tls/signClient/v2`, this.api.url);
        url.searchParams.append('clientUid', this.api.auth.username + ' (ETL)');
        url.searchParams.append('version', '3');

        const res = await this.api.fetch(url, {
            method: 'POST',
            nocookies: true,
            headers: {
                Accept: 'application/json',
                Authorization: 'Basic ' + btoa(this.api.auth.username + ":" + this.api.auth.password)
            },
            body: keys.csr
        });

        let cert = '-----BEGIN CERTIFICATE-----\n' + res.signedCert;
        if (!res.signedCert.endsWith('\n')) cert = cert + '\n';
        cert = cert + '-----END CERTIFICATE-----';

        return {
            cert,
            key: keys.clientKey
        }
    }
}
