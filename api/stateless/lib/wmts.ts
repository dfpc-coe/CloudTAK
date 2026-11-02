import xmljs from 'xml-js';
import Err from '@openaddresses/batch-error';
import { Basemap_Format, Basemap_Type } from '../../common/enums.js';

// ScaleDenominator of zoom 0 in the WMTS GoogleMapsCompatible well-known scale set
const WEB_MERCATOR_Z0_SCALE = 559082264.0287178;
const WEB_MERCATOR_ORIGIN = 20037508.342789244;
const WEB_MERCATOR_CRS = /(3857|900913|3785|102100|102113|WebMercator|GoogleMapsCompatible)/i;

type XmlNode = Record<string, any>;

export interface WMTSImport {
    type: Basemap_Type;
    name: string;
    attribution?: string;
    minzoom: number;
    maxzoom: number;
    tiles: string[];
    format: Basemap_Format;
    tileSize?: number;
    bounds?: [number, number, number, number];
    center?: number[];
}

interface Matrix {
    identifier: string;
    zoom: number;
    tileSize: number;
}

export function isWMTSCapabilities(xml: string): boolean {
    return /<(?:\w+:)?Capabilities[\s>]/.test(xml) && xml.includes('opengis.net/wmts');
}

export function isWMSCapabilities(xml: string): boolean {
    return /<(?:\w+:)?(?:WMS_Capabilities|WMT_MS_Capabilities)[\s>]/.test(xml);
}

function children(node: XmlNode | undefined, local: string): XmlNode[] {
    if (!node) return [];
    for (const key of Object.keys(node)) {
        if (key === local || key.endsWith(`:${local}`)) {
            const value = node[key];
            return Array.isArray(value) ? value : [value];
        }
    }
    return [];
}

function child(node: XmlNode | undefined, local: string): XmlNode | undefined {
    return children(node, local)[0];
}

function text(node: XmlNode | undefined, local?: string): string | undefined {
    const target = local ? child(node, local) : node;
    if (!target) return undefined;
    const value = target._text ?? target._cdata;
    return value === undefined ? undefined : String(value).trim();
}

function attr(node: XmlNode | undefined, name: string): string | undefined {
    const value = node?._attributes?.[name];
    return value === undefined ? undefined : String(value);
}

function formatFromMime(mime: string | undefined): Basemap_Format {
    const type = String(mime || '').toLowerCase();
    if (type.includes('jpeg') || type.includes('jpg')) {
        return type.includes('png') ? Basemap_Format.PNG : Basemap_Format.JPEG;
    }
    if (type.includes('webp')) return Basemap_Format.WEBP;
    if (type.includes('vector-tile') || type.includes('protobuf')) return Basemap_Format.MVT;
    return Basemap_Format.PNG;
}

function formatRank(mime: string | undefined): number {
    const type = String(mime || '').toLowerCase();
    if (type === 'image/png') return 0;
    if (type.startsWith('image/png')) return 1;
    if (type.includes('jpeg') || type.includes('jpg')) return 2;
    if (type.includes('webp')) return 3;
    return 4;
}

function matrices(set: XmlNode, allowed?: Set<string>): Matrix[] {
    const corner = text(child(set, 'TileMatrix'), 'TopLeftCorner');
    if (corner) {
        const [x, y] = corner.split(/\s+/).map(Number);
        if (Math.abs(Math.abs(x) - WEB_MERCATOR_ORIGIN) > 1 || Math.abs(Math.abs(y) - WEB_MERCATOR_ORIGIN) > 1) {
            return [];
        }
    }

    const out: Matrix[] = [];
    for (const matrix of children(set, 'TileMatrix')) {
        const identifier = text(matrix, 'Identifier');
        const scale = Number(text(matrix, 'ScaleDenominator'));
        if (!identifier || !Number.isFinite(scale) || scale <= 0) return [];
        if (allowed && !allowed.has(identifier)) continue;

        const exact = Math.log2(WEB_MERCATOR_Z0_SCALE / scale);
        const zoom = Math.round(exact);
        if (Math.abs(exact - zoom) > 0.05) return [];

        out.push({
            identifier,
            zoom,
            tileSize: Number(text(matrix, 'TileWidth')) || 256,
        });
    }

    return out.sort((a, b) => a.zoom - b.zoom);
}

// Shared text preceding the zoom number in TileMatrix identifiers, ie "EPSG:900913:" for GeoServer
function zoomPrefix(set: Matrix[]): string | undefined {
    const prefixes = new Set(set.map((m) => {
        const suffix = String(m.zoom);
        return m.identifier.endsWith(suffix) ? m.identifier.slice(0, -suffix.length) : null;
    }));

    if (prefixes.size !== 1) return undefined;
    const [prefix] = prefixes;
    return prefix === null ? undefined : prefix;
}

function kvpGetTileURL(capabilities: XmlNode): string | undefined {
    const operations = children(child(capabilities, 'OperationsMetadata'), 'Operation');
    const getTile = operations.find(op => attr(op, 'name') === 'GetTile');
    const gets = children(child(child(getTile, 'DCP'), 'HTTP'), 'Get');

    for (const get of gets) {
        const constraints = children(get, 'Constraint').filter(c => attr(c, 'name') === 'GetEncoding');
        const encodings = constraints.flatMap(c => children(child(c, 'AllowedValues'), 'Value').map(v => text(v)));
        if (!encodings.length || encodings.includes('KVP')) return attr(get, 'xlink:href') || attr(get, 'href');
    }

    return undefined;
}

export function parseWMTSCapabilities(xml: string, opts: { layer?: string | null } = {}): WMTSImport {
    let doc: XmlNode;
    try {
        doc = xmljs.xml2js(xml, { compact: true }) as XmlNode;
    } catch (err) {
        throw new Err(400, err instanceof Error ? err : new Error(String(err)), 'Unable to parse WMTS capabilities XML');
    }

    const capabilities = child(doc, 'Capabilities');
    if (!capabilities) throw new Err(400, null, 'XML document is not a WMTS capabilities document');

    const contents = child(capabilities, 'Contents');
    const layers = children(contents, 'Layer');
    if (!layers.length) throw new Err(400, null, 'WMTS capabilities do not list any layers');

    const layer = opts.layer
        ? layers.find(l => text(l, 'Identifier') === opts.layer)
        : layers[0];
    if (!layer) throw new Err(400, null, `WMTS layer "${opts.layer}" not found in capabilities`);

    const layerId = text(layer, 'Identifier') || '';
    const sets = new Map<string, XmlNode>();
    for (const set of children(contents, 'TileMatrixSet')) {
        const id = text(set, 'Identifier');
        if (id) sets.set(id, set);
    }

    const candidates: Array<{ id: string; matrices: Matrix[]; prefix: string; rank: number }> = [];
    for (const link of children(layer, 'TileMatrixSetLink')) {
        const id = text(link, 'TileMatrixSet');
        const set = id ? sets.get(id) : undefined;
        if (!id || !set) continue;

        const crs = text(set, 'SupportedCRS') || '';
        if (!WEB_MERCATOR_CRS.test(crs) && !WEB_MERCATOR_CRS.test(id)) continue;

        const limited = children(child(link, 'TileMatrixSetLimits'), 'TileMatrixLimits')
            .map(l => text(l, 'TileMatrix'))
            .filter((v): v is string => !!v);

        const ms = matrices(set, limited.length ? new Set(limited) : undefined);
        if (!ms.length) continue;

        const prefix = zoomPrefix(ms);
        if (prefix === undefined) continue;

        candidates.push({
            id,
            matrices: ms,
            prefix,
            rank: /GoogleMapsCompatible|WebMercatorQuad/i.test(id) ? 0 : 1,
        });
    }

    candidates.sort((a, b) => a.rank - b.rank);
    const chosen = candidates[0];
    if (!chosen) {
        throw new Err(400, null, `WMTS layer "${layerId}" has no Web Mercator (EPSG:3857) TileMatrixSet and cannot be used as a basemap`);
    }

    const styles = children(layer, 'Style');
    const style = text(styles.find(s => attr(s, 'isDefault') === 'true') || styles[0], 'Identifier') || 'default';

    const resources = children(layer, 'ResourceURL')
        .filter(r => (attr(r, 'resourceType') || 'tile') === 'tile' && attr(r, 'template'))
        .sort((a, b) => formatRank(attr(a, 'format')) - formatRank(attr(b, 'format')));

    let template: string;
    let mime: string | undefined;

    if (resources.length) {
        template = attr(resources[0], 'template')!;
        mime = attr(resources[0], 'format');

        template = template
            .replace(/\{Style\}/gi, style)
            .replace(/\{TileMatrixSet\}/gi, chosen.id)
            .replace(/\{TileMatrix\}/gi, `${chosen.prefix}{$z}`)
            .replace(/\{TileRow\}/gi, '{$y}')
            .replace(/\{TileCol\}/gi, '{$x}');

        for (const dimension of children(layer, 'Dimension')) {
            const id = text(dimension, 'Identifier');
            const value = text(dimension, 'Default') || text(dimension, 'Value');
            if (id && value !== undefined) {
                template = template.replace(new RegExp(`\\{${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'gi'), value);
            }
        }

        const unresolved = template.match(/\{(?!\$[zxy]\})[^}]+\}/g);
        if (unresolved) {
            throw new Err(400, null, `WMTS tile template has unsupported variables: ${unresolved.join(', ')}`);
        }
    } else {
        const base = kvpGetTileURL(capabilities);
        if (!base) throw new Err(400, null, `WMTS layer "${layerId}" exposes neither a RESTful tile template nor a KVP GetTile endpoint`);

        const formats = children(layer, 'Format').map(f => text(f)).filter((f): f is string => !!f);
        mime = formats.sort((a, b) => formatRank(a) - formatRank(b))[0] || 'image/png';

        const params = new URLSearchParams({
            SERVICE: 'WMTS',
            REQUEST: 'GetTile',
            VERSION: '1.0.0',
            LAYER: layerId,
            STYLE: style,
            FORMAT: mime,
            TILEMATRIXSET: chosen.id,
        });

        const separator = /[?&]$/.test(base) ? '' : (base.includes('?') ? '&' : '?');
        template = `${base}${separator}${params.toString()}&TILEMATRIX=${encodeURIComponent(chosen.prefix)}{$z}&TILEROW={$y}&TILECOL={$x}`;
    }

    const format = formatFromMime(mime);

    const imported: WMTSImport = {
        type: format === Basemap_Format.MVT ? Basemap_Type.VECTOR : Basemap_Type.RASTER,
        name: text(layer, 'Title') || layerId,
        minzoom: chosen.matrices[0].zoom,
        maxzoom: chosen.matrices[chosen.matrices.length - 1].zoom,
        tiles: [template],
        format,
    };

    const tileSize = chosen.matrices[0].tileSize;
    if (tileSize !== 256) imported.tileSize = tileSize;

    const provider = text(child(child(capabilities, 'ServiceProvider'), 'ProviderName'));
    if (provider) imported.attribution = provider;

    const bbox = child(layer, 'WGS84BoundingBox');
    const lower = text(bbox, 'LowerCorner')?.split(/\s+/).map(Number);
    const upper = text(bbox, 'UpperCorner')?.split(/\s+/).map(Number);
    if (lower && upper && [...lower, ...upper].every(Number.isFinite) && lower.length === 2 && upper.length === 2) {
        imported.bounds = [lower[0], lower[1], upper[0], upper[1]];
        imported.center = [(lower[0] + upper[0]) / 2, (lower[1] + upper[1]) / 2, imported.minzoom];
    }

    return imported;
}
