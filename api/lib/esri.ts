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
                        objectIdField: 'OBJECTID',
                        uniqueIdField: {
                            name: "OBJECTID",
                            isSystemMaintained: true
                        },
                        extent: {
                            xmin: -20037508.34,
                            ymin: -20048966.1,
                            xmax: 20037508.34,
                            ymax: 20048966.1,
                            spatialReference: { wkid: 102100, latestWkid: 3857 }
                        },
                        fields: [{
                            "name": "OBJECTID",
                            "type": "esriFieldTypeOID",
                            "actualType": "int",
                            "alias": "FID",
                            "sqlType": "sqlTypeInteger",
                            "length": 4,
                            "nullable": false,
                            "editable": false,
                            "domain": null,
                            "defaultValue": null
                        },{
                            "name": "CallSign",
                            "type": "esriFieldTypeString",
                            "actualType": "nvarchar",
                            "alias": "CallSign",
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

        console.error(json);

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
