import Err from '@openaddresses/batch-error';
import EsriDump from 'esri-dump';
import { Static, Type } from '@sinclair/typebox';
import { fetch, isSafeUrl } from '@tak-ps/node-safeurl';
import { TileJSON } from './tilejson.js';

export enum EsriType {
    AGOL = 'AGOL',
    PORTAL = 'PORTAL',
    SERVER = 'SERVER',
}

export enum EsriLayerType {
    MAP = 'MapServer',
    FEATURE = 'FeatureServer',
    IMAGE = 'ImageServer',
    UNKNOWN = 'Unknown',
}

export function isEsriLayerURL(url: string): boolean {
    return !!(
        String(url).match(/\/FeatureServer\/\d+$/)
        || String(url).match(/\/MapServer\/\d+$/)
        || String(url).match(/\/ImageServer$/)
    );
}

/**
 * Unauthenticated view of an ESRI REST endpoint, mirroring the CloudTAK API
 * EsriBase. Tile proxying never carries ESRI credentials so the token flows
 * are not ported.
 */
export class EsriBase {
    type: EsriType;
    base: URL;
    postfix: string;

    constructor(base: string | URL) {
        base = EsriBase.toURL(base);

        this.type = EsriBase.sniff(base);

        if (this.type === EsriType.AGOL || this.type === EsriType.PORTAL) {
            this.postfix = base.pathname.replace(/.*sharing\/rest/i, '');
            base.pathname = base.pathname.replace(/(?<=sharing\/rest).*/i, '');
        } else {
            this.postfix = base.pathname.replace(/.*\/rest/, '');
            base.pathname = base.pathname.replace(/\/rest.*/, '/rest');
        }

        this.base = base;
    }

    static sniff(base: string | URL): EsriType {
        base = EsriBase.toURL(base);

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

    private static toURL(base: string | URL): URL {
        try {
            return new URL(base);
        } catch (err) {
            if (err instanceof Error && err.name === 'PublicError') throw err;
            throw new Err(400, err instanceof Error ? err : new Error(String(err)), err instanceof Error ? err.message : String(err));
        }
    }
}

export class EsriProxyLayer {
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

    async tilejson(): Promise<Static<typeof TileJSON>> {
        const url = `${this.esri.base}${this.esri.postfix}`;

        // esri-dump fetches with the global fetch, so guard the URL here
        const { safe, reason } = await isSafeUrl(url);
        if (!safe) throw new Err(400, null, `Blocked URL: ${reason}`);

        const esri = new EsriDump(url, { headers: {} });
        const json = await esri.tilejson();

        // esri-dump defaults to 'vector' for MapServer layers that lack both
        // geometryType and serviceDataType in their metadata. Check the explicit
        // layer type field to correctly identify Raster Layers.
        let isVector = json.type === 'vector';
        if (isVector && this.type === EsriLayerType.MAP) {
            const metaURL = new URL(url);
            metaURL.searchParams.set('f', 'json');
            const metaRes = await fetch(metaURL);
            const meta = await metaRes.typed(Type.Object({ type: Type.Optional(Type.String()) }));
            if (meta.type === 'Raster Layer') isVector = false;
        }

        return {
            name: json.name || 'Unknown',
            tilejson: '3.0.0',
            version: '1.0.0',
            description: '',
            type: isVector ? 'vector' : 'raster',
            tiles: [url],
            bounds: json.bounds || [-180, -85.0511, 180, 85.0511],
            center: Array.isArray(json.center) ? json.center : [0, 0],
            minzoom: json.minzoom,
            maxzoom: json.maxzoom,
            scheme: 'xyz',
            format: isVector ? 'mvt' : 'png',
            vector_layers: json.vector_layers,
        };
    }
}
