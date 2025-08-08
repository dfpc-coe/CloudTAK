import Err from '@openaddresses/batch-error';
import { Static, Type } from '@sinclair/typebox';
import { OptionalTileJSON } from './types.js';
import { Basemap_Format, Basemap_Type, Basemap_Scheme  } from './enums.js';
import { fetch } from '@tak-ps/etl';
import { ESRILayerList, EsriExtent } from './esri/types.js';
import {
    DefaultLayerPoints,
    DefaultLayerLines,
    DefaultLayerPolys
} from './esri/layer.js'

export enum EsriType {
    AGOL = 'AGOL',      // ArcGIS Online Portal
    PORTAL = 'PORTAL',  // Enterprise Portal
    SERVER = 'SERVER'   // Stand-Alone Server
}

export enum EsriLayerType {
    MAP = 'MapServer',
    FEATURE = 'FeatureServer',
    IMAGE = 'ImageServer',
    UNKNOWN = 'Unknown'
}

export const ImageLayer = Type.Object({
    name: Type.String(),
    description: Type.String(),
    extent: EsriExtent
});

export const FeatureLayer = Type.Object({
    currentVersion: Type.Number(),
    id: Type.Integer(),
    name: Type.String(),
    geometryType: Type.String(),
    description: Type.String(),
    extent: EsriExtent
});

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
 * Determine what type of ESRI Asset is being connected to
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
            this.postfix = base.pathname.replace(/.*\/rest/, '');
            base.pathname = base.pathname.replace(/\/rest.*/, '/rest');

        }

        this.base = base;
    }

    static async from(
        base: string | URL,
        auth?: EsriAuth
    ): Promise<EsriBase> {
        const esri = new EsriBase(base, auth);
        await esri.fetchVersion();

        if (auth) await esri.generateToken();

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

            let json = await res.json() as Record<string, unknown>

            if (json.error) {
                // @ts-expect-error No Typing on JSON Body
                throw new Err(400, null, `ESRI Server Error: ${json.error.message} - ${String(json.error.details)}`);
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
            if (err instanceof Error && err.name === 'PublicError') throw err;
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
        } else if (base.pathname.toLowerCase().includes('/rest')) {
            return EsriType.SERVER;
        }

        throw new Err(400, null, 'Could not determine URL Type');
    }

    /**
     * The root of any portal REST endpoint should return
     * a version string that can be parsed and verified
     */
    async fetchVersion(): Promise<number> {
        try {
            const url = new URL(this.base);
            url.searchParams.append('f', 'json');
            const res = await fetch(url);

            const json = await res.typed(Type.Object({
                currentVersion: Type.String(),
                error: Type.Optional(Type.Object({
                    message: Type.String()
                }))
            }))

            if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

            if (!json.currentVersion) throw new Err(400, null, 'Could not determine ESRI Server Version, is this an ESRI Server?');

            if (this.type === EsriType.PORTAL || this.type === EsriType.SERVER) {
                if (String(json.currentVersion).split('.').length < 2) {
                    throw new Err(400, null, `Could not parse ESRI Server Version (${json.currentVersion}) - this version may not be supported`);
                }

                const major = parseInt(String(json.currentVersion).split('.')[0])
                if (isNaN(major)) throw new Err(400, null, `Could not parse ESRI Server Version (${json.currentVersion}) - non-integer - this version may not be supported`);
                if (major < 8) throw new Err(400, null, `ESRI Server version (${json.currentVersion}) is too old - Update to at least version 8.x`)
            }

            // ArcGIS Online (AGOL) uses a <year>.<month?> format - assume it's always at the bleeding edge

            return Number(json.currentVersion);
        } catch (err) {
            if (err instanceof Error && err.name === 'PublicError') throw err;
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
            if (err instanceof Error && err.name === 'PublicError') throw err;
            throw new Err(400, err instanceof Error ? err : new Error(String(err)), err instanceof Error ? err.message : String(err));
        }

        return base as URL;
    }

    standardHeaders(): Headers {
        const headers = new Headers();
        if (this.token && this.token.token) {
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

        // @ts-expect-error Untyped Response
        if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

        return json as { username: string };
    }

    async getPortal(): Promise<object> {
        try {
            const url = new URL(this.esri.base + '/portals/self');
            url.searchParams.append('f', 'json');
            const res = await fetch(url);

            const json = await res.json()

            // @ts-expect-error Untyped Response
            if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

            return json as object;
        } catch (err) {
            if (err instanceof Error && err.name === 'PublicError') throw err;
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

        // @ts-expect-error Untyped Response
        if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

        return json as { username: string };
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

        // @ts-expect-error Untyped Response
        if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

        return json as {
            servers: any[]
        };
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

        // @ts-expect-error Untyped Response
        if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

        return json as object;
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

        // @ts-expect-error Untyped Response
        if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

        return json as object;
    }

    async createLayer(layerDefinition: Static<typeof ESRILayerList> = {
        layers: [DefaultLayerPoints , DefaultLayerLines, DefaultLayerPolys]
    }): Promise<object> {
        const url = new URL(this.esri.base)
        url.pathname = url.pathname.replace(/\/rest/i, '/rest/admin' + this.esri.postfix + '/addToDefinition');

        const headers = this.esri.standardHeaders();
        headers.append('Content-Type', 'application/x-www-form-urlencoded');
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: new URLSearchParams({
                'f': 'json',
                'addToDefinition': JSON.stringify(layerDefinition)
            })
        });

        const json = await res.json()

        // @ts-expect-error Untyped Response
        if (json.error) throw new Err(400, new Error(JSON.stringify(json.error)), 'ESRI Server Error: ' + json.error.message);

        return json as object;
    }

    async getList(postfix: string): Promise<object> {
        const headers = this.esri.standardHeaders();

        const url = new URL(this.esri.base + postfix);
        url.searchParams.append('f', 'json');

        const res = await fetch(url, {
            method: 'GET',
            headers
        });

        const json = await res.json() as Record<string, unknown>

        // @ts-expect-error Untyped Response
        if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);
        // @ts-expect-error Untyped Response
        else if (json.status === 'error') throw new Err(400, null, 'ESRI Server Error: ' + json.messages[0]);

        return json as object;
    }
}

class EsriProxyLayer {
    esri: EsriBase;
    type: EsriLayerType;

    constructor(esri: EsriBase) {
        this.esri = esri;

        this.type = EsriLayerType.UNKNOWN;
        if (this.esri.postfix.includes('FeatureServer')) {
            this.type = EsriLayerType.FEATURE;
        } else if (this.esri.postfix.includes('MapServer')) {
            this.type = EsriLayerType.MAP;
        } else if (this.esri.postfix.includes('ImageServer')) {
            this.type = EsriLayerType.IMAGE;
        }
    }

    async tilejson(): Promise<Static<typeof OptionalTileJSON>> {
        const url = new URL(this.esri.base + this.esri.postfix);
        url.searchParams.append('f', 'json');

        const res = await fetch(url);

        if ([EsriLayerType.FEATURE, EsriLayerType.MAP].includes(this.type)) {
            const json = await res.typed(FeatureLayer)

            // @ts-expect-error ESRI JSON Format
            if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

            return {
                name: json.name,
                type: Basemap_Type.VECTOR,
                url: this.esri.base + this.esri.postfix,
                bounds: [json.extent.xmin, json.extent.ymin, json.extent.xmax, json.extent.ymax],
                minzoom: 0,
                maxzoom: 20,
                style: Basemap_Scheme.XYZ,
                format: Basemap_Format.MVT
            }
        } else if (this.type === EsriLayerType.IMAGE) {
            const json = await res.typed(ImageLayer)

            // @ts-expect-error ESRI JSON Format
            if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

            return {
                name: json.name,
                type: Basemap_Type.RASTER,
                url: this.esri.base + this.esri.postfix,
                bounds: [json.extent.xmin, json.extent.ymin, json.extent.xmax, json.extent.ymax],
                minzoom: 0,
                maxzoom: 20,
                style: Basemap_Scheme.XYZ,
                format: Basemap_Format.PNG
            }
        } else {
            throw new Err(400, null, 'Unsupported ESRI Layer Type');
        }
    }

    async sample(where: string): Promise<{
        count: number,
        features: object
    }> {
        if (![EsriLayerType.FEATURE, EsriLayerType.MAP].includes(this.type)) {
            throw new Err(400, null, 'Can only sample a FeatureServer or MapServer');
        }

        const count: any = await this.#sampleFeatures(where, true);
        const features: any = await this.#sampleFeatures(where, false);

        return {
            count: count.count,
            features
        }
    }

    async #sampleFeatures(where: string, countOnly=false): Promise<object> {
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

        // @ts-expect-error ESRI JSON Format
        if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

        return json as object;
    }
}


export {
    EsriProxyPortal,
    EsriProxyServer,
    EsriProxyLayer
}
