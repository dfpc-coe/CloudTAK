import Err from '@openaddresses/batch-error';

export enum EsriPortalType {
    AGOL = 'AGOL',
    SERVER = 'SERVER'
}

class EsriProxyPortal {
    type: EsriPortalType;
    token: string;
    expires: number;
    base: URL;
    referer: string;

    constructor(token: string, expires: number, base: URL, referer: string) {
        this.token = token;
        this.expires = expires;
        this.base = base;
        this.referer = referer;

        this.type = EsriProxyPortal.isAGOL(base) ? EsriPortalType.AGOL : EsriPortalType.SERVER;
    }

    static isAGOL(url: URL): boolean {
        return !!url.hostname.match(/\maps\.arcgis\.com$/)
    }

    static parser(url: URL): URL {
        const base = new URL(url.origin);
        const path = url.pathname.replace(/\/rest.*/, '') + '/rest';
        base.pathname = path;
        return base;
    }

    /**
     * The root of any portal REST endpoint should return
     * a version string that can be parsed and verified
     */
    static async isPortalBase(base: URL): Promise<boolean> {
        try {
            const url = new URL(base);
            url.searchParams.append('f', 'json');
            const res = await fetch(url);

            const json = await res.json()

            if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

            if (!json.currentVersion || typeof json.currentVersion !== 'string') throw new Err(400, null, 'Could not determine ESRI Server Version, is this an ESRI Portal URL?');

            // ArcGIS Online uses a <year>.<month?> format - assume it's alawys at the bleeding edge
            if (!EsriProxyPortal.isAGOL(url)) {
                if (json.currentVersion.split('.').length < 2) throw new Err(400, null, 'Could not parse ESRI Server Version - this version may not be supported');

                const major = parseInt(json.currentVersion.split('.')[0])
                if (isNaN(major)) throw new Err(400, null, 'Could not parse ESRI Server Version - non-integer - this version may not be supported');
                if (major < 8) throw new Err(400, null, 'ESRI Server version is too old - Update to at least version 8.x')
            }

            return true;
        } catch (err) {
            throw new Err(400, err, err.message);
        }
    }

    /**
     * Generates a token but first verifies the server information
     * Used for User facing functions - if the server has already been
     * ensured to be correct, call generateToken directly
     */
    static async init(
        url: URL,
        referer: string,
        username: string,
        password: string
    ): Promise<EsriProxyPortal> {
        const base = this.parser(url);

        await this.isPortalBase(base);

        return await this.generateToken(base, referer, username, password)
    }

    static async generateToken(
        url: URL,
        referer: string,
        username: string,
        password: string
    ): Promise<EsriProxyPortal> {
        const body = new URLSearchParams();
        body.append('username', username);
        body.append('password', password);
        body.append('referer', referer);
        body.append('expiration', String(21600));

        const base = this.parser(url);

        try {
            const url = new URL(base + '/generateToken');
            url.searchParams.append('f', 'json');
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: String(body)
            });

            const json = await res.json()

            if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

            return new EsriProxyPortal(
                json.token,
                json.expires,
                this.parser(url),
                referer
            );
        } catch (err) {
            throw new Err(400, err, err.message);
        }
    }

    async getContent(opts: {
        title?: string
    }): Promise<{
        username: string
    }> {
        if (opts.title) opts.title = `(${opts.title.replace(/"/g, '')})`;
        else opts.title = '';

        const url = new URL(this.base + `/search`);
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

        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'Referer': this.referer,
                'X-Esri-Authorization': `Bearer ${this.token}`
            },
        });

        const json = await res.json()

        if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

        return json;
    }

    async getPortal(): Promise<object> {
        try {
            const url = new URL(this.base + '/portals/self');
            url.searchParams.append('f', 'json');
            const res = await fetch(url);

            const json = await res.json()

            if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

            return json;
        } catch (err) {
            throw new Err(400, err, err.message);
        }
    }

    async getSelf(): Promise<{
        username: string
    }> {
        const url = new URL(this.base + `/community/self`);
        url.searchParams.append('f', 'json');

        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'Referer': this.referer,
                'X-Esri-Authorization': `Bearer ${this.token}`
            },
        });

        const json = await res.json()

        if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

        return json;
    }

    async getServers() {
        const url = new URL(this.base + '/portals/self/servers');
        url.searchParams.append('f', 'json');
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'Referer': this.referer,
                'X-Esri-Authorization': `Bearer ${this.token}`
            },
        });

        const json = await res.json()

        if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

        return json;
    }

    async createService(name: string): Promise<object> {
        const meta = await this.getSelf();

        // TODO: Check if meta allows Service Creation

        const url = new URL(this.base + `/content/users/${meta.username}/createService`);
        url.searchParams.append('f', 'json');

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Referer': this.referer,
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Esri-Authorization': `Bearer ${this.token}`
            },
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
    portal: EsriProxyPortal;
    base: URL;

    constructor(portal: EsriProxyPortal, url: URL) {
        this.portal = portal;
        this.base = url;
    }

    async deleteLayer(id: number): Promise<object> {
        const url = new URL(this.base);
        url.pathname = url.pathname.replace('/rest/', '/rest/admin/') + '/deleteFromDefinition';
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Referer': this.portal.referer,
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Esri-Authorization': `Bearer ${this.portal.token}`
            },
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
        const url = new URL(this.base);
        url.pathname = url.pathname.replace('/rest/', '/rest/admin/') + '/addToDefinition';
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Referer': this.portal.referer,
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Esri-Authorization': `Bearer ${this.portal.token}`
            },
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
                            "type": "esriFieldTypeString",
                            "actualType": "nvarchar",
                            "alias": "time",
                            "sqlType": "sqlTypeNVarchar",
                            "length": 100,
                            "nullable": true,
                            "editable": true,
                            "domain": null,
                            "defaultValue": null
                        },{
                            "name": "start",
                            "type": "esriFieldTypeString",
                            "actualType": "nvarchar",
                            "alias": "start",
                            "sqlType": "sqlTypeNVarchar",
                            "length": 100,
                            "nullable": true,
                            "editable": true,
                            "domain": null,
                            "defaultValue": null
                        },{
                            "name": "stale",
                            "type": "esriFieldTypeString",
                            "actualType": "nvarchar",
                            "alias": "stale",
                            "sqlType": "sqlTypeNVarchar",
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

    async getList(): Promise<object> {
        const res = await fetch(this.base + `?f=json`, {
            method: 'GET',
            headers: {
                'Referer': this.portal.referer,
                'X-Esri-Authorization': `Bearer ${this.portal.token}`
            },
        });

        const json = await res.json()

        if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

        return json;
    }
}

export {
    EsriProxyPortal,
    EsriProxyServer
}
