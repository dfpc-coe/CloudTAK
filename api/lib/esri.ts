import Err from '@openaddresses/batch-error';
import EsriDump from 'esri-dump';
import { Static, Type } from '@sinclair/typebox';
import { OptionalTileJSON } from './types.js';
import { Basemap_Format, Basemap_Type, Basemap_Scheme  } from './enums.js';
import { fetch } from '@tak-ps/etl';
import { ESRILayerList } from './esri/types.js';
import {
    DefaultLayerPoints,
    DefaultLayerLines,
    DefaultLayerPolys,
    ESRIFieldMapping,
    requiredFields
} from './esri/layer.js'

type EsriFieldMapping = Static<typeof ESRIFieldMapping>;

interface EsriLayerMetadata {
    fields?: Array<{
        name?: string;
        type?: string;
    }>;
    error?: {
        message?: string;
        details?: unknown;
    };
    status?: string;
    messages?: string[];
}

interface EsriMutationResponse {
    success?: boolean;
    error?: {
        message?: string;
        details?: unknown;
    };
    status?: string;
    messages?: string[];
}

function esriError(body: EsriLayerMetadata | EsriMutationResponse): string | undefined {
    if (body.error) {
        const details = body.error.details ? ` - ${JSON.stringify(body.error.details)}` : '';
        return `${body.error.message || 'Unknown ESRI error'}${details}`;
    } else if (body.status === 'error') {
        return body.messages?.join(', ') || 'Unknown ESRI error';
    } else if ('success' in body && body.success === false) {
        return 'ESRI request failed';
    }

    return undefined;
}

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

export const ESRIPortal = Type.Object({
    id: Type.String(),
    name: Type.String()
    // There are more fields, but we only care about these for now
});

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
                // @ts-expect-error Need stronger types
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
        const fetchCurrentVersion = async (url: URL): Promise<number> => {
            url.searchParams.set('f', 'json');
            const res = await fetch(url);

            const json = await res.typed(Type.Object({
                currentVersion: Type.Optional(Type.String()),
                error: Type.Optional(Type.Object({
                    message: Type.String()
                }))
            }), {
                verbose: true
            })

            if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);
            if (!json.currentVersion) throw new Err(400, null, 'Could not determine ESRI Server Version, is this an ESRI Server?');

            if (this.type === EsriType.PORTAL || this.type === EsriType.SERVER) {
                const major = parseInt(String(json.currentVersion).split('.')[0])
                if (isNaN(major)) throw new Err(400, null, `Could not parse ESRI Server Version (${json.currentVersion}) - non-integer - this version may not be supported`);
                if (major < 8) throw new Err(400, null, `ESRI Server version (${json.currentVersion}) is too old - Update to at least version 8.x`)
            }

            // ArcGIS Online (AGOL) uses a <year>.<month?> format - assume it's always at the bleeding edge
            return Number(json.currentVersion);
        };

        try {
            const url = new URL(this.base);
            try {
                return await fetchCurrentVersion(url);
            } catch (err) {
                // Some ArcGIS Server deployments expose version metadata at /rest/services
                // even when /rest itself cannot be used for version detection.
                if (this.type === EsriType.SERVER && url.pathname.endsWith('/rest')) {
                    const fallback = new URL(url);
                    fallback.pathname = `${fallback.pathname}/services`;

                    try {
                        return await fetchCurrentVersion(fallback);
                    } catch {
                        throw err;
                    }
            }

                throw err;
            }
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

    standardHeaderObject(): Record<string, string> {
        return Object.fromEntries(this.standardHeaders().entries());
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

        const portal = await this.getPortal();

        const query = [];
        if (opts.title) query.push(opts.title);
        query.push(`orgid:${portal.id}`)
        query.push('type:("Feature Service")');
        url.searchParams.append('q', query.join(' '));

        const headers = this.esri.standardHeaderObject();
        const res = await fetch(url, {
            method: 'GET',
            headers
        });

        const json = await res.json()

        if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

        return json as { username: string };
    }

    async getPortal(): Promise<Static<typeof ESRIPortal>> {
        try {
            const url = new URL(this.esri.base + '/portals/self');
            url.searchParams.append('f', 'json');

            const headers = this.esri.standardHeaderObject();
            const res = await fetch(url, {
                headers
            });

            if (!res.ok) {
                const json = await res.json();
                if (json.error) {
                    throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);
                } else {
                    throw new Err(400, null, `ESRI Server returned HTTP ${res.status} ${res.statusText}`);
                }
            }

            return await res.typed(ESRIPortal, {
                verbose: true
            })
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

        const headers = this.esri.standardHeaderObject();
        const res = await fetch(url, {
            method: 'GET',
            headers
        });

        const json = await res.json()

        if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

        return json as { username: string };
    }

    async getServers() {
        const url = new URL(this.esri.base + '/portals/self/servers');
        url.searchParams.append('f', 'json');

        const headers = this.esri.standardHeaderObject();
        const res = await fetch(url, {
            method: 'GET',
            headers
        });

        const json = await res.json()

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

        const headerObj = this.esri.standardHeaderObject();
        headerObj['Content-Type'] = 'application/x-www-form-urlencoded';
        const res = await fetch(url, {
            method: 'POST',
            headers: headerObj,
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

        const headerObj = this.esri.standardHeaderObject();
        headerObj['Content-Type'] = 'application/x-www-form-urlencoded';
        const res = await fetch(url, {
            method: 'POST',
            headers: headerObj,
            body: new URLSearchParams({
                'f': 'json',
                'deleteFromDefinition': JSON.stringify({
                    layers: [{ "id": id }]
                })
            })
        });

        const json = await res.json()

        if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

        return json as object;
    }

    async createLayer(layerDefinition: Static<typeof ESRILayerList> = {
        layers: [DefaultLayerPoints , DefaultLayerLines, DefaultLayerPolys]
    }): Promise<object> {
        const url = new URL(this.esri.base)
        url.pathname = url.pathname.replace(/\/rest/i, '/rest/admin' + this.esri.postfix + '/addToDefinition');

        const headerObj = this.esri.standardHeaderObject();
        headerObj['Content-Type'] = 'application/x-www-form-urlencoded';
        const res = await fetch(url, {
            method: 'POST',
            headers: headerObj,
            body: new URLSearchParams({
                'f': 'json',
                'addToDefinition': JSON.stringify(layerDefinition)
            })
        });

        const json = await res.json()

        if (json.error) throw new Err(400, new Error(JSON.stringify(json.error)), 'ESRI Server Error: ' + json.error.message);

        return json as object;
    }

    async updateLayerFields(fields: EsriFieldMapping[]): Promise<object> {
        const headers = this.esri.standardHeaderObject();

        const metadataURL = new URL(this.esri.base + this.esri.postfix);
        metadataURL.searchParams.append('f', 'json');

        const metadataResponse = await fetch(metadataURL, {
            method: 'GET',
            headers
        });

        const metadata = await metadataResponse.json() as EsriLayerMetadata;
        const metadataError = esriError(metadata);
        if (metadataError) throw new Err(400, null, 'ESRI Server Error: ' + metadataError);
        if (!Array.isArray(metadata.fields)) throw new Err(400, null, 'Could not read ESRI layer fields');

        const existingFields = new Map<string, { name?: string; type?: string }>();
        for (const field of metadata.fields) {
            if (field.name) existingFields.set(field.name.toLowerCase(), field);
        }

        const missingFields = [];
        for (const field of requiredFields(fields)) {
            const existing = existingFields.get(field.name.toLowerCase());

            if (!existing) {
                missingFields.push(field);
            } else if (existing.type && existing.type !== field.type) {
                throw new Err(400, null, `ESRI field ${field.name} is ${existing.type}; expected ${field.type}`);
            }
        }

        if (!missingFields.length) {
            return {
                success: true,
                added: 0,
                fields: []
            };
        }

        const url = new URL(this.esri.base)
        url.pathname = url.pathname.replace(/\/rest/i, '/rest/admin' + this.esri.postfix + '/addToDefinition');

        const headerObj = this.esri.standardHeaderObject();
        headerObj['Content-Type'] = 'application/x-www-form-urlencoded';
        const res = await fetch(url, {
            method: 'POST',
            headers: headerObj,
            body: new URLSearchParams({
                'f': 'json',
                'addToDefinition': JSON.stringify({
                    fields: missingFields
                })
            })
        });

        const json = await res.json() as EsriMutationResponse;
        const mutationError = esriError(json);
        if (mutationError) throw new Err(400, new Error(JSON.stringify(json)), 'ESRI Server Error: ' + mutationError);

        return {
            ...json,
            added: missingFields.length,
            fields: missingFields.map((field) => field.name)
        };
    }

    async getList(postfix: string): Promise<object> {
        const headers = this.esri.standardHeaderObject();

        const url = new URL(this.esri.base + postfix);
        url.searchParams.append('f', 'json');

        const res = await fetch(url, {
            method: 'GET',
            headers
        });

        const json = await res.json() as Record<string, unknown>

                // @ts-expect-error Need stronger types
        if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);
                // @ts-expect-error Need stronger types
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
        const url = `${this.esri.base}${this.esri.postfix}`;
        const esri = new EsriDump(url, {
            headers: this.esri.standardHeaderObject()
        });
        const json = await esri.tilejson();

        return {
            name: json.name,
            type: json.type === 'vector' ? Basemap_Type.VECTOR : Basemap_Type.RASTER,
            url,
            bounds: json.bounds,
            center: json.center,
            minzoom: json.minzoom,
            maxzoom: json.maxzoom,
            style: Basemap_Scheme.XYZ,
            format: json.type === 'vector' ? Basemap_Format.MVT : Basemap_Format.PNG,
            vector_layers: json.vector_layers
        };
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

        const headerObj = this.esri.standardHeaderObject();
        headerObj['Content-Type'] = 'application/x-www-form-urlencoded';

        const res = await fetch(url, {
            method: 'GET',
            headers: headerObj
        });

        const json = await res.json()

        if (json.error) throw new Err(400, null, 'ESRI Server Error: ' + json.error.message);

        return json as object;
    }
}


export {
    EsriProxyPortal,
    EsriProxyServer,
    EsriProxyLayer
}
