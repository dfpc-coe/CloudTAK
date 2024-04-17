import Err from '@openaddresses/batch-error';

export enum EsriType {
    AGOL = 'AGOL',      // ArcGIS Online Portal
    PORTAL = 'PORTAL',  // Enterprise Portal
    SERVER = 'SERVER'   // Stand-Alone Server
}

export interface EsriToken {
    token: string;
    expires: number;
    referer: string;
}

export interface EsriAuth {
    username: string;
    password: string;
    referer: string;
    expiration?: number;
}

/**
 * Determine what tyoe of ESRI Asset is being connected to
 * And handle unified auth between them
 */
export class EsriBase {
    type: EsriType;
    base: URL;
    postfix: string;
    auth?: EsriAuth;
    token?: EsriToken;
    version?: string;

    constructor(base: string | URL, auth?: EsriAuth) {
        base = EsriBase.#toURL(base);

        this.type = EsriBase.sniff(base);
        this.auth = auth;

        if (this.type === EsriType.AGOL || this.type === EsriType.PORTAL) {
            this.postfix = base.pathname.replace(/.*sharing\/rest/i, '');
            base.pathname = base.pathname.replace(/(?<=sharing\/rest).*/i, '');
        } else { // EsriType === SERVER
            this.postfix = base.pathname;
            base.pathname = base.pathname = '';

        }

        this.base = base;
    }

    static async from(base: string | URL, auth?: EsriAuth): Promise<EsriBase> {
        const esri = new EsriBase(base, auth);
        await esri.fetchVersion();
        await esri.generateToken();
        return esri;
    }

    async generateToken(): Promise<EsriToken> {
        if (!this.auth) throw new Err(400, null, 'Cannot generate token without auth');

        const body = new URLSearchParams();
        body.append('f', 'json');
        body.append('username', this.auth.username);
        body.append('password', this.auth.password);
        body.append('client', 'referer');
        body.append('encrypted', 'false');
        body.append('referer', this.auth.referer);
        body.append('expiration', String(this.auth.expiration || 21600));

        const url = new URL(this.base);
        if (this.type === EsriType.SERVER) {
            url.pathname = url.pathname.replace('/rest', '/tokens/generateToken');
        } else {
            url.pathname = url.pathname + '/generateToken'
        }

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: String(body)
            });

            let json: { [k: string]: unknown; } = await res.json()

            if (json.error) {
                // @ts-expect-error
                throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);
            }

            if (!('token' in json) && typeof json.token === 'string') throw new Err(400, null, 'ESRI Server did not provide token');
            if (!('expires' in json) && typeof json.expires === 'number') throw new Err(400, null, 'ESRI Server did not provide token expiration');

            json = json as {
                token: string;
                expires: number;
                referer: string;
            }

            this.token = {
                token: String(json.token),
                expires: parseInt(String(json.expires)),
                referer: this.auth.referer
            };

            return this.token;
        } catch (err) {
            if (err.name === 'PublicError') throw err;
            throw new Err(400, err instanceof Error ? err : new Error(String(err)), err instanceof Error ? err.message : String(err));
        }
    }

    static sniff(base: string | URL): EsriType {
        base = EsriBase.#toURL(base);

        if (base.hostname.match(/maps\.arcgis\.com$/)) {
            return EsriType.AGOL;
        } else if (base.pathname.toLowerCase().includes('/arcgis/rest')) {
            return EsriType.SERVER;
        } else if (base.pathname.toLowerCase().includes('/sharing/rest')) {
            return EsriType.PORTAL;
        } else if (base.pathname.toLowerCase().includes('/rest/services')) {
            return EsriType.SERVER;
        }

        throw new Err(400, null, 'Could not determine URL Type');
    }

    /**
     * The root of any portal REST endpoint should return
     * a version string that can be parsed and verified
     */
    async fetchVersion(): Promise<string> {
        try {
            const url = new URL(this.base);
            url.searchParams.append('f', 'json');
            const res = await fetch(url);

            const json = await res.json()

            if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

            if (!json.currentVersion) throw new Err(400, null, 'Could not determine ESRI Server Version, is this an ESRI Server?');

            if (this.type === EsriType.PORTAL || this.type === EsriType.SERVER) {
                if (String(json.currentVersion).split('.').length < 2) throw new Err(400, null, 'Could not parse ESRI Server Version - this version may not be supported');

                const major = parseInt(String(json.currentVersion).split('.')[0])
                if (isNaN(major)) throw new Err(400, null, 'Could not parse ESRI Server Version - non-integer - this version may not be supported');
                if (major < 8) throw new Err(400, null, 'ESRI Server version is too old - Update to at least version 8.x')
            }

            // ArcGIS Online (AGOL) uses a <year>.<month?> format - assume it's always at the bleeding edge

            return json.currentVersion;
        } catch (err) {
            if (err.name === 'PublicError') throw err;
            if (err instanceof Error) {
                if (err.cause) err.message = `${err.message}: ${err.cause}`;
                throw new Err(400, err, String(err));
            } else {
                throw new Err(400, new Error(String(err)), String(err));
            }
        }
    }

    static #toURL(base: string | URL): URL {
        try {
            base = new URL(base);
        } catch (err) {
            if (err.name === 'PublicError') throw err;
            throw new Err(400, err instanceof Error ? err : new Error(String(err)), err instanceof Error ? err.message : String(err));
        }

        base as URL;
        return base;
    }

    standardHeaders(): Headers {
        const headers = new Headers();
        if (this.token) {
            headers.append('Referer', this.token.referer);
            headers.append('X-Esri-Authorization', `Bearer ${this.token.token}`);
        }

        return headers;
    }
}

/**
 * ArcGIS Servers can optionally be managed by an ESRI Portal
 * Portals provide auth and content search across one or many servers
 */
class EsriProxyPortal {
    esri: EsriBase;

    constructor(esri: EsriBase) {
        this.esri = esri;
    }

    async getContent(opts: {
        title?: string
    }): Promise<{
        username: string
    }> {
        if (opts.title) opts.title = `(${opts.title.replace(/"/g, '')})`;
        else opts.title = '';

        const url = new URL(this.esri.base + `/search`);
        url.searchParams.append('f', 'json');
        url.searchParams.append('num', '20');
        url.searchParams.append('start', '1');
        url.searchParams.append('sortField', 'modified');
        url.searchParams.append('sortOrder', 'desc');
        // User could technically XSSish us but since this is a query parameter
        // the onus to protect the query is on ESRI as the input is already untrusted

        const portal: any = await this.getPortal();

        const query = [];
        if (opts.title) query.push(opts.title);
        query.push(`orgid:${portal.id}`)
        query.push('type:("Feature Service")');
        url.searchParams.append('q', query.join(' '));

        const headers = this.esri.standardHeaders();
        const res = await fetch(url, {
            method: 'GET',
            headers
        });

        const json = await res.json()

        if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

        return json;
    }

    async getPortal(): Promise<object> {
        try {
            const url = new URL(this.esri.base + '/portals/self');
            url.searchParams.append('f', 'json');
            const res = await fetch(url);

            const json = await res.json()

            if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

            return json;
        } catch (err) {
            if (err.name === 'PublicError') throw err;
            throw new Err(400, err instanceof Error ? err : new Error(String(err)), err instanceof Error ? err.message : String(err));
        }
    }

    async getSelf(): Promise<{
        username: string
    }> {
        const url = new URL(this.esri.base + `/community/self`);
        url.searchParams.append('f', 'json');

        const headers = this.esri.standardHeaders();
        const res = await fetch(url, {
            method: 'GET',
            headers
        });

        const json = await res.json()

        if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

        return json;
    }

    async getServers() {
        const url = new URL(this.esri.base + '/portals/self/servers');
        url.searchParams.append('f', 'json');

        const headers = this.esri.standardHeaders();
        const res = await fetch(url, {
            method: 'GET',
            headers
        });

        const json = await res.json()

        if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

        return json;
    }

    async createService(name: string): Promise<object> {
        const meta = await this.getSelf();

        // TODO: Check if meta allows Service Creation

        const url = new URL(this.esri.base + `/content/users/${meta.username}/createService`);
        url.searchParams.append('f', 'json');

        const headers = this.esri.standardHeaders();
        headers.append('Content-Type', 'application/x-www-form-urlencoded');
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: new URLSearchParams({
                'f': 'json',
                'createParameters': JSON.stringify({
                    name,
                    spatialReference: { wkid: 102100, latestWkid: 3857 },
                    allowGeometryUpdates: true,
                }),
                'outputType': 'featureService',
                'description': 'Automatically Created via the TAK ETL Service',
            })
        });

        const json = await res.json()

        if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

        return json;
    }

}

class EsriProxyServer {
    esri: EsriBase;

    constructor(esri: EsriBase) {
        this.esri = esri;
    }

    async deleteLayer(id: number): Promise<object> {
        const url = new URL(this.esri.base)
        url.pathname = url.pathname.replace(/\/rest/i, '/rest/admin' + this.esri.postfix + '/deleteFromDefinition');

        const headers = this.esri.standardHeaders();
        headers.append('Content-Type', 'application/x-www-form-urlencoded');
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: new URLSearchParams({
                'f': 'json',
                'deleteFromDefinition': JSON.stringify({
                    layers: [{ "id": id }]
                })
            })
        });

        const json = await res.json()

        if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

        return json;
    }

    async createLayer(): Promise<object> {
        const url = new URL(this.esri.base)
        url.pathname = url.pathname.replace(/\/rest/i, '/rest/admin' + this.esri.postfix + '/addToDefinition');

        const headers = this.esri.standardHeaders();
        headers.append('Content-Type', 'application/x-www-form-urlencoded');
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: new URLSearchParams({
                'f': 'json',
                'addToDefinition': JSON.stringify({
                    layers: [{
                        id: 0,
                        name: 'TAK ETL Points',
                        description: 'CoT message Points',
                        type: 'Feature Layer',
                        displayField: 'callsign',
                        supportedQueryFormats: 'JSON',
                        capabilities: "Create,Delete,Query,Update,Editing,Extract,Sync",
                        geometryType: 'esriGeometryPoint',
                        allowGeometryUpdates: true,
                        hasAttachments: false,
                        hasM: false,
                        hasZ: false,
                        objectIdField: 'objectid',
                        extent: {
                            xmin: -20037508.34,
                            ymin: -20048966.1,
                            xmax: 20037508.34,
                            ymax: 20048966.1,
                            spatialReference: { wkid: 102100, latestWkid: 3857 },
                        },
                        uniqueIdField: {
                            name: "objectid",
                            isSystemMaintained: true
                        },
                        fields: [{
                            "name": "objectid",
                            "type": "esriFieldTypeOID",
                            "actualType": "int",
                            "alias": "fid",
                            "sqlType": "sqlTypeInteger",
                            "length": 4,
                            "nullable": false,
                            "editable": false,
                            "domain": null,
                            "defaultValue": null
                        },{
                            "name": "cotuid",
                            "type": "esriFieldTypeString",
                            "actualType": "nvarchar",
                            "alias": "cotuid1",
                            "sqlType": "sqlTypeNVarchar",
                            "length": 100,
                            "nullable": false,
                            "editable": true,
                            "domain": null,
                            "defaultValue": null
                        },{
                            "name": "callsign",
                            "type": "esriFieldTypeString",
                            "actualType": "nvarchar",
                            "alias": "callsign",
                            "sqlType": "sqlTypeNVarchar",
                            "length": 100,
                            "nullable": true,
                            "editable": true,
                            "domain": null,
                            "defaultValue": null
                        },{
                            "name": "type",
                            "type": "esriFieldTypeString",
                            "actualType": "nvarchar",
                            "alias": "type",
                            "sqlType": "sqlTypeNVarchar",
                            "length": 100,
                            "nullable": true,
                            "editable": true,
                            "domain": null,
                            "defaultValue": null
                        },{
                            "name": "how",
                            "type": "esriFieldTypeString",
                            "actualType": "nvarchar",
                            "alias": "how",
                            "sqlType": "sqlTypeNVarchar",
                            "length": 100,
                            "nullable": true,
                            "editable": true,
                            "domain": null,
                            "defaultValue": null
                        },{
                            "name": "time",
                            "type": "esriFieldTypeDate",
                            "actualType": "datetime2",
                            "alias": "time",
                            "sqlType": "sqlTypeTimestamp2",
                            "length": 100,
                            "nullable": true,
                            "editable": true,
                            "domain": null,
                            "defaultValue": null
                        },{
                            "name": "start",
                            "type": "esriFieldTypeDate",
                            "actualType": "datetime2",
                            "alias": "start",
                            "sqlType": "sqlTypeTimestamp2",
                            "length": 100,
                            "nullable": true,
                            "editable": true,
                            "domain": null,
                            "defaultValue": null
                        },{
                            "name": "stale",
                            "type": "esriFieldTypeDate",
                            "actualType": "datetime2",
                            "alias": "stale",
                            "sqlType": "sqlTypeTimestamp2",
                            "length": 100,
                            "nullable": true,
                            "editable": true,
                            "domain": null,
                            "defaultValue": null
                        }]
                    }]
                })
            })
        });

        const json = await res.json()

        if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

        return json;
    }

    async getList(postfix: string): Promise<object> {
        const headers = this.esri.standardHeaders();

        const url = new URL(this.esri.base + postfix);
        url.searchParams.append('f', 'json');

        const res = await fetch(url, {
            method: 'GET',
            headers
        });

        const json = await res.json()

        if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);
        else if (json.status === 'error') throw new Err(400, null, 'ESRI Server Error: ' + json.messages[0]);

        return json;
    }
}

class EsriProxyLayer {
    esri: EsriBase;

    constructor(esri: EsriBase) {
        this.esri = esri;
    }

    async query(where: string): Promise<object> {
        const count: any = await this.#features(where, true);
        const features: any = await this.#features(where, false);

        return {
            count: count.count,
            features
        }
    }

    async #features(where: string, countOnly=false): Promise<object> {
        const url = new URL(this.esri.base + this.esri.postfix + '/query');
        url.searchParams.append('f', 'json');
        url.searchParams.append('where', where);
        if (countOnly) {
            url.searchParams.append('returnCountOnly', 'true');
        } else {
            url.searchParams.append('resultRecordCount', '5');
        }

        const headers = this.esri.standardHeaders();
        headers.append('Content-Type', 'application/x-www-form-urlencoded');
        const res = await fetch(url, {
            method: 'GET',
            headers
        });

        const json = await res.json()

        if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

        return json;
    }
}


export {
    EsriProxyPortal,
    EsriProxyServer,
    EsriProxyLayer
}
