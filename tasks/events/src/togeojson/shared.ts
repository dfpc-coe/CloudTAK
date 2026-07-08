import { type XmlElement, type XmlNode, get1, nodeVal } from './xml.ts';

export type P = Record<string, unknown>;

export function normalizeId(id: string): string {
    return id[0] === '#' ? id : `#${id}`;
}

export function get(
    node: XmlNode | null,
    tagName: string,
    callback?: (el: XmlElement, properties: P) => P,
): P {
    const properties: P = {};
    if (!node) return properties;
    const result = get1(node, tagName);
    if (result && callback) {
        return callback(result, properties);
    }
    return properties;
}

export function val1(
    node: XmlNode,
    tagName: string,
    callback: (val: string) => P | undefined,
): P {
    const val = nodeVal(get1(node, tagName));
    if (val && callback) return callback(val) || {};
    return {};
}

export function $num(
    node: XmlNode,
    tagName: string,
    callback: (val: number) => P | undefined,
): P | undefined {
    const val = Number.parseFloat(nodeVal(get1(node, tagName)));
    if (Number.isNaN(val)) return undefined;
    if (val && callback) return callback(val) || {};
    return {};
}

export function num1(
    node: XmlNode,
    tagName: string,
    callback?: (val: number) => void,
): number | undefined {
    const val = Number.parseFloat(nodeVal(get1(node, tagName)));
    if (Number.isNaN(val)) return undefined;
    if (callback) callback(val);
    return val;
}

export function getMulti(node: XmlNode, propertyNames: string[]): P {
    const properties: P = {};
    for (const property of propertyNames) {
        val1(node, property, (val) => {
            properties[property] = val;
            return undefined;
        });
    }
    return properties;
}
