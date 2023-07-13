import Err from '@openaddresses/batch-error';

export default class EsriProxy {
    token: string;
    expires: number;
    base: URL;
    referer: string;

    constructor(token: string, expires: number, base: URL, referer: string) {
        this.token = token;
        this.expires = expires;
        this.base = base;
        this.referer = referer;
    }

    static parser(url: URL): URL {
        const base = new URL(url.origin);
        const path = url.pathname.replace(/\/rest.*/, '') + '/rest';
        base.pathname = path;
        return base;
    }

    async getContent(): Promise<{
        username: string
    }> {
        const url = new URL(this.base + `/search?f=json`);
        url.searchParams.append('f', 'json');
        url.searchParams.append('num', '20');
        url.searchParams.append('start', '1');
        url.searchParams.append('sortField', 'modified');
        url.searchParams.append('sortOrder', 'desc');
        url.searchParams.append('filter', 'type:"Feature Service"');

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

    async deleteLayer(id: number) {
        const url = new URL(this.base);
        url.pathname = url.pathname.replace('/rest/', '/rest/admin/') + '/deleteFromDefinition';
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Referer': this.referer,
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Esri-Authorization': `Bearer ${this.token}`
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

    async getSelf(): Promise<{
        username: string
    }> {
        const url = new URL(this.base);
        url.pathname = url.pathname.replace(/server\/rest.*$/, 'portal/sharing/rest/community/self');
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

        const url = new URL(this.base);
        url.pathname = url.pathname.replace(/server\/rest.*$/, `portal/sharing/rest/content/users/${meta.username}`) + '/createService';

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

        return {};
    }

    async createLayer() {
        const url = new URL(this.base);
        url.pathname = url.pathname.replace('/rest/', '/rest/admin/') + '/addToDefinition';
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Referer': this.referer,
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Esri-Authorization': `Bearer ${this.token}`
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

    async getList() {
        const res = await fetch(this.base + `?f=json`, {
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
        const res = await fetch(this.base + `/portals/self/servers?f=json`, {
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

    static async generateToken(
        url: URL,
        referer: string,
        username: string,
        password: string
    ): Promise<EsriProxy> {
        const body = new URLSearchParams();
        body.append('username', username);
        body.append('password', password);
        body.append('referer', referer);
        body.append('expiration', String(21600));

        const base = this.parser(url);

        try {
            const res = await fetch(base + '/generateToken?f=json', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: String(body)
            });

            const json = await res.json()

            if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

            return new EsriProxy(
                json.token,
                json.expires,
                this.parser(url),
                referer
            );
        } catch (err) {
            throw new Err(400, err, err.message);
        }
    }
}
