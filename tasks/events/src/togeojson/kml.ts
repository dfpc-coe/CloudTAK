import type { F, FC, Folder, KmlOptions, Root } from './types.ts';
import { normalizeId, val1 } from './shared.ts';
import {
    type XmlElement,
    type XmlNode,
    $,
    childElements,
    getAttribute,
    isElement,
    nodeVal,
    parseXml,
} from './xml.ts';
import { extractStyle } from './kml/extractStyle.ts';
import { getGroundOverlay } from './kml/ground_overlay.ts';
import { getNetworkLink } from './kml/networklink.ts';
import { getPlacemark } from './kml/placemark.ts';
import { type Schema, type StyleMap, typeConverters } from './kml/shared.ts';

function localName(el: XmlElement): string {
    const colon = el.name.indexOf(':');
    return colon === -1 ? el.name : el.name.slice(colon + 1);
}

function getStyleId(style: XmlElement, parent: XmlNode | null): string {
    let id = getAttribute(style, 'id');
    if (!id && isElement(parent) && localName(parent) === 'CascadingStyle') {
        id = getAttribute(parent, 'kml:id') || getAttribute(parent, 'id');
    }
    return normalizeId(id || '');
}

function buildStyleMap(node: XmlNode): StyleMap {
    const styleMap: StyleMap = {};

    // Document-order walk that tracks each Style element's parent so ids on
    // CascadingStyle wrappers resolve like the DOM parentNode lookup
    (function walk(parent: XmlNode) {
        for (const child of childElements(parent)) {
            if (child.name === 'Style') {
                styleMap[getStyleId(child, parent)] = extractStyle(child);
            }
            walk(child);
        }
    })(node);

    for (const map of $(node, 'StyleMap')) {
        const id = normalizeId(getAttribute(map, 'id') || '');
        val1(map, 'styleUrl', (styleUrl) => {
            styleUrl = normalizeId(styleUrl);
            if (styleMap[styleUrl]) {
                styleMap[id] = styleMap[styleUrl];
            }
            return undefined;
        });
    }

    return styleMap;
}

function buildSchema(node: XmlNode): Schema {
    const schema: Schema = {};
    for (const field of $(node, 'SimpleField')) {
        schema[getAttribute(field, 'name') || '']
            = typeConverters[getAttribute(field, 'type') || ''] || typeConverters.string;
    }
    return schema;
}

const FOLDER_PROPS = [
    'name',
    'visibility',
    'open',
    'address',
    'description',
    'phoneNumber',
    'visibility',
];

function getFolder(node: XmlElement): Folder {
    const meta: Record<string, unknown> = {};
    for (const child of childElements(node)) {
        if (FOLDER_PROPS.includes(child.name)) {
            meta[child.name] = nodeVal(child);
        }
    }
    return {
        type: 'folder',
        meta,
        children: [],
    };
}

function toRoot(input: string | XmlNode): XmlNode {
    return typeof input === 'string' ? parseXml(input) : input;
}

/**
 * Yield a nested tree with KML folder structure
 *
 * This generates a tree with the given structure:
 *
 * ```js
 * {
 *   "type": "root",
 *   "children": [
 *     {
 *       "type": "folder",
 *       "meta": {
 *         "name": "Test"
 *       },
 *       "children": [
 *          // ...features and folders
 *       ]
 *     }
 *     // ...features
 *   ]
 * }
 * ```
 *
 * ### GroundOverlay
 *
 * GroundOverlay elements are converted into
 * `Feature` objects with `Polygon` geometries,
 * a property like:
 *
 * ```json
 * {
 *   "@geometry-type": "groundoverlay"
 * }
 * ```
 *
 * And the ground overlay's image URL in the `href`
 * property. Ground overlays will need to be displayed
 * with a separate method to other features, depending
 * on which map framework you're using.
 */
export function kmlWithFolders(
    input: string | XmlNode,
    options: KmlOptions = { skipNullGeometry: false },
): Root {
    const n = toRoot(input);
    const styleMap = buildStyleMap(n);
    const schema = buildSchema(n);
    const tree: Root = { type: 'root', children: [] };

    function traverse(node: XmlNode, pointer: Root | Folder) {
        if (isElement(node)) {
            switch (node.name) {
                case 'GroundOverlay': {
                    const placemark = getGroundOverlay(node, styleMap, schema, options);
                    if (placemark) {
                        pointer.children.push(placemark);
                    }
                    break;
                }
                case 'Placemark': {
                    const placemark = getPlacemark(node, styleMap, schema, options);
                    if (placemark) {
                        pointer.children.push(placemark);
                    }
                    break;
                }
                case 'Folder': {
                    const folder = getFolder(node);
                    pointer.children.push(folder);
                    pointer = folder;
                    break;
                }
                case 'NetworkLink': {
                    const networkLink = getNetworkLink(node, styleMap, schema, options);
                    if (networkLink) {
                        pointer.children.push(networkLink);
                    }
                    break;
                }
            }
        }

        for (const child of node.elements || []) {
            traverse(child, pointer);
        }
    }

    traverse(n, tree);

    return tree;
}

/**
 * Convert KML to GeoJSON incrementally, returning
 * a [Generator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Iterators_and_Generators)
 * that yields output feature by feature.
 */
export function* kmlGen(
    input: string | XmlNode,
    options: KmlOptions = { skipNullGeometry: false },
): Generator<F> {
    const n = toRoot(input);
    const styleMap = buildStyleMap(n);
    const schema = buildSchema(n);
    for (const placemark of $(n, 'Placemark')) {
        const feature = getPlacemark(placemark, styleMap, schema, options);
        if (feature) yield feature;
    }
    for (const groundOverlay of $(n, 'GroundOverlay')) {
        const feature = getGroundOverlay(groundOverlay, styleMap, schema, options);
        if (feature) yield feature;
    }
    for (const networkLink of $(n, 'NetworkLink')) {
        const feature = getNetworkLink(networkLink, styleMap, schema, options);
        if (feature) yield feature;
    }
}

/**
 * Convert a KML document to GeoJSON. The first argument must be the KML
 * document as an XML string (or an already-parsed tree from parseXml).
 *
 * The output is a JavaScript object of GeoJSON data. You can convert it to a string
 * with [JSON.stringify](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)
 * or use it directly in libraries.
 */
export function kml(
    input: string | XmlNode,
    options: KmlOptions = { skipNullGeometry: false },
): FC {
    return {
        type: 'FeatureCollection',
        features: Array.from(kmlGen(toRoot(input), options)),
    };
}
