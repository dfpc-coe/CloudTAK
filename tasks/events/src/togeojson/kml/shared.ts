import { type P, get, normalizeId, val1 } from '../shared.ts';
import { type XmlElement, type XmlNode, $, get1, getAttribute, nodeVal } from '../xml.ts';

export type TypeConverter = (x: string) => unknown;
export type Schema = Record<string, TypeConverter>;
export type StyleMap = Record<string, P>;

const toNumber = (x: string) => Number(x);
export const typeConverters: Record<string, TypeConverter> = {
    string: (x: string) => x,
    int: toNumber,
    uint: toNumber,
    short: toNumber,
    ushort: toNumber,
    float: toNumber,
    double: toNumber,
    bool: (x: string) => Boolean(x),
};

export function extractExtendedData(node: XmlNode, schema: Schema): P {
    return get(node, 'ExtendedData', (extendedData, properties) => {
        for (const data of $(extendedData, 'Data')) {
            properties[getAttribute(data, 'name') || ''] = nodeVal(get1(data, 'value'));
        }
        for (const simpleData of $(extendedData, 'SimpleData')) {
            const name = getAttribute(simpleData, 'name') || '';
            const typeConverter = schema[name] || typeConverters.string;
            properties[name] = typeConverter(nodeVal(simpleData));
        }
        return properties;
    });
}

export function getMaybeHTMLDescription(node: XmlNode): P {
    const descriptionNode = get1(node, 'description');
    for (const c of descriptionNode?.elements || []) {
        if (c.type === 'cdata') {
            return {
                description: {
                    '@type': 'html',
                    'value': String(c.cdata ?? ''),
                },
            };
        }
    }
    return {};
}

export function extractTimeSpan(node: XmlNode): P {
    return get(node, 'TimeSpan', (timeSpan) => {
        return {
            timespan: {
                begin: nodeVal(get1(timeSpan, 'begin')),
                end: nodeVal(get1(timeSpan, 'end')),
            },
        };
    });
}

export function extractTimeStamp(node: XmlNode): P {
    return get(node, 'TimeStamp', (timeStamp) => {
        return { timestamp: nodeVal(get1(timeStamp, 'when')) };
    });
}

export function extractCascadedStyle(node: XmlNode, styleMap: StyleMap): P {
    return val1(node, 'styleUrl', (styleUrl) => {
        styleUrl = normalizeId(styleUrl);
        if (styleMap[styleUrl]) {
            return Object.assign({ styleUrl }, styleMap[styleUrl]);
        }
        // For backward-compatibility. Should we still include
        // styleUrl even if it's not resolved?
        return { styleUrl };
    });
}

enum AltitudeMode {
    ABSOLUTE = 'absolute',
    RELATIVE_TO_GROUND = 'relativeToGround',
    CLAMP_TO_GROUND = 'clampToGround',
    CLAMP_TO_SEAFLOOR = 'clampToSeaFloor',
    RELATIVE_TO_SEAFLOOR = 'relativeToSeaFloor',
}

export function processAltitudeMode(mode: XmlElement | null): AltitudeMode | null {
    switch (mode ? nodeVal(mode) : null) {
        case AltitudeMode.ABSOLUTE:
            return AltitudeMode.ABSOLUTE;
        case AltitudeMode.CLAMP_TO_GROUND:
            return AltitudeMode.CLAMP_TO_GROUND;
        case AltitudeMode.CLAMP_TO_SEAFLOOR:
            return AltitudeMode.CLAMP_TO_SEAFLOOR;
        case AltitudeMode.RELATIVE_TO_GROUND:
            return AltitudeMode.RELATIVE_TO_GROUND;
        case AltitudeMode.RELATIVE_TO_SEAFLOOR:
            return AltitudeMode.RELATIVE_TO_SEAFLOOR;
    }
    return null;
}
