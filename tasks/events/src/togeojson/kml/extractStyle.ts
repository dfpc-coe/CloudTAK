import { type P, get, num1, val1 } from '../shared.ts';
import { type XmlNode, getAttribute, nodeVal } from '../xml.ts';
import { fixColor } from './fixColor.ts';

function numericProperty(node: XmlNode, source: string, target: string): P {
    const properties: P = {};
    num1(node, source, (val) => {
        properties[target] = val;
    });
    return properties;
}

function getColor(node: XmlNode, output: string): P {
    return get(node, 'color', elem => fixColor(nodeVal(elem), output));
}

export function extractIconHref(node: XmlNode): P {
    return get(node, 'Icon', (icon, properties) => {
        val1(icon, 'href', (href) => {
            properties.icon = href;
            return undefined;
        });
        return properties;
    });
}

function extractIcon(node: XmlNode): P {
    return get(node, 'IconStyle', (iconStyle) => {
        return Object.assign(
            getColor(iconStyle, 'icon'),
            numericProperty(iconStyle, 'scale', 'icon-scale'),
            numericProperty(iconStyle, 'heading', 'icon-heading'),
            get(iconStyle, 'hotSpot', (hotspot) => {
                const left = Number.parseFloat(getAttribute(hotspot, 'x') || '');
                const top = Number.parseFloat(getAttribute(hotspot, 'y') || '');
                const xunits = getAttribute(hotspot, 'xunits') || '';
                const yunits = getAttribute(hotspot, 'yunits') || '';
                if (!Number.isNaN(left) && !Number.isNaN(top)) {
                    return {
                        'icon-offset': [left, top],
                        'icon-offset-units': [xunits, yunits],
                    };
                }
                return {};
            }),
            extractIconHref(iconStyle),
        );
    });
}

function extractLabel(node: XmlNode): P {
    return get(node, 'LabelStyle', (labelStyle) => {
        return Object.assign(
            getColor(labelStyle, 'label'),
            numericProperty(labelStyle, 'scale', 'label-scale'),
        );
    });
}

function extractLine(node: XmlNode): P {
    return get(node, 'LineStyle', (lineStyle) => {
        return Object.assign(
            getColor(lineStyle, 'stroke'),
            numericProperty(lineStyle, 'width', 'stroke-width'),
        );
    });
}

function extractPoly(node: XmlNode): P {
    return get(node, 'PolyStyle', (polyStyle, properties) => {
        return Object.assign(
            properties,
            get(polyStyle, 'color', elem => fixColor(nodeVal(elem), 'fill')),
            val1(polyStyle, 'fill', (fill) => {
                if (fill === '0') return { 'fill-opacity': 0 };
                return undefined;
            }),
            val1(polyStyle, 'outline', (outline) => {
                if (outline === '0') return { 'stroke-opacity': 0 };
                return undefined;
            }),
        );
    });
}

export function extractStyle(node: XmlNode): P {
    return Object.assign(
        {},
        extractPoly(node),
        extractLine(node),
        extractLabel(node),
        extractIcon(node),
    );
}
