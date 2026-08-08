import xmljs from '@tak-ps/xml-js';

/**
 * Non-compact node produced by @tak-ps/xml-js, annotated at parse time with
 * resolved namespace information (_ns / _local) so namespace-aware lookups
 * work without parent pointers.
 */
export interface XmlNode {
    type?: 'element' | 'text' | 'cdata' | 'comment' | 'instruction' | 'doctype';
    name?: string;
    attributes?: Record<string, string | number | undefined>;
    elements?: XmlNode[];
    text?: string | number;
    cdata?: string;
    declaration?: unknown;
    _ns?: string;
    _local?: string;
}

export interface XmlElement extends XmlNode {
    type: 'element';
    name: string;
}

export function isElement(node: XmlNode | null | undefined): node is XmlElement {
    return !!node && node.type === 'element' && typeof node.name === 'string';
}

/**
 * Parse an XML string into an annotated node tree.
 *
 * Unlike DOM parsers this is namespace-tolerant: prefixes are part of the
 * node name and an undeclared prefix (e.g. ArcGIS's xsi:schemaLocation
 * without xmlns:xsi) is not an error. Namespace URIs are still resolved
 * where declared so namespace-aware lookups behave like the DOM equivalents.
 */
export function parseXml(input: string): XmlNode {
    // Strip a leading UTF-8 BOM (U+FEFF)
    if (input.charCodeAt(0) === 0xFEFF) {
        input = input.slice(1);
    }

    // captureSpacesBetweenElements keeps whitespace-only text nodes so that
    // nodeVal() concatenation matches DOM textContent exactly
    const root = xmljs.xml2js(input, {
        compact: false,
        captureSpacesBetweenElements: true,
    }) as XmlNode;
    annotate(root, '', new Map());
    return root;
}

function annotate(node: XmlNode, defaultNs: string, prefixes: Map<string, string>): void {
    if (!node.elements) return;

    for (const child of node.elements) {
        if (!isElement(child)) continue;

        let childDefault = defaultNs;
        let childPrefixes = prefixes;

        if (child.attributes) {
            for (const [attr, value] of Object.entries(child.attributes)) {
                if (attr === 'xmlns') {
                    childDefault = String(value ?? '');
                } else if (attr.startsWith('xmlns:')) {
                    if (childPrefixes === prefixes) childPrefixes = new Map(prefixes);
                    childPrefixes.set(attr.slice(6), String(value ?? ''));
                }
            }
        }

        const colon = child.name.indexOf(':');
        if (colon === -1) {
            child._local = child.name;
            child._ns = childDefault;
        } else {
            child._local = child.name.slice(colon + 1);
            child._ns = childPrefixes.get(child.name.slice(0, colon)) || '';
        }

        annotate(child, childDefault, childPrefixes);
    }
}

export function childElements(node: XmlNode): XmlElement[] {
    return (node.elements || []).filter(isElement);
}

/**
 * All descendant elements with the given qualified name, in document order.
 * Mirrors DOM getElementsByTagName (does not include the node itself).
 */
export function $(node: XmlNode, tagName: string): XmlElement[] {
    const found: XmlElement[] = [];
    collect(node, el => el.name === tagName, found);
    return found;
}

/**
 * All descendant elements with the given local name in the given namespace
 * URI, in document order. Mirrors DOM getElementsByTagNameNS: pass '*' as
 * either argument to match any local name / any namespace.
 */
export function $ns(node: XmlNode, localName: string, ns: string): XmlElement[] {
    const found: XmlElement[] = [];
    collect(node, (el) => {
        return (localName === '*' || el._local === localName)
            && (ns === '*' || el._ns === ns);
    }, found);
    return found;
}

function collect(node: XmlNode, match: (el: XmlElement) => boolean, found: XmlElement[]): void {
    for (const child of node.elements || []) {
        if (!isElement(child)) continue;
        if (match(child)) found.push(child);
        collect(child, match, found);
    }
}

/**
 * Get the first descendant element with the given qualified name, if any,
 * otherwise null
 */
export function get1(
    node: XmlNode,
    tagName: string,
    callback?: (el: XmlElement) => void,
): XmlElement | null {
    const result = first(node, tagName);
    if (result && callback) callback(result);
    return result;
}

function first(node: XmlNode, tagName: string): XmlElement | null {
    for (const child of node.elements || []) {
        if (!isElement(child)) continue;
        if (child.name === tagName) return child;
        const nested = first(child, tagName);
        if (nested) return nested;
    }
    return null;
}

/**
 * Get the text content of a node, if any. Mirrors DOM textContent:
 * concatenates all descendant text and CDATA sections in document order.
 */
export function nodeVal(node: XmlNode | null | undefined): string {
    if (!node) return '';
    let out = '';
    for (const child of node.elements || []) {
        if (child.type === 'text') {
            out += String(child.text ?? '');
        } else if (child.type === 'cdata') {
            out += String(child.cdata ?? '');
        } else if (child.type === 'element') {
            out += nodeVal(child);
        }
    }
    return out;
}

export function getAttribute(node: XmlNode, name: string): string | null {
    const value = node.attributes?.[name];
    return value === undefined ? null : String(value);
}
