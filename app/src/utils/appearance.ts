import Type2525, { SID_MAP, SID_REVERSE_MAP } from '@tak-ps/node-cot/2525';
import type { Feature } from '../types.ts';

/**
 * Appearance editing for point Features: "what it is" (affiliation + type)
 * and "how it looks" (MIL-STD symbol, Iconset icon or plain dot)
 */

export type Marker = 'symbol' | 'icon' | 'dot';

export type AffiliationFamily = 'friendly' | 'hostile' | 'neutral' | 'unknown' | 'other';

export interface Affiliation {
    code: string;
    label: string;
    meaning: string;
    family: AffiliationFamily;
    /** Shown as a chip - the rest live under "More affiliations" */
    primary: boolean;
}

export const AFFILIATIONS: Affiliation[] = [
    { code: 'f', label: 'Friendly', meaning: 'Known friendly', family: 'friendly', primary: true },
    { code: 'h', label: 'Hostile', meaning: 'Known hostile', family: 'hostile', primary: true },
    { code: 'n', label: 'Neutral', meaning: 'Known neutral', family: 'neutral', primary: true },
    { code: 'u', label: 'Unknown', meaning: 'Evaluated, affiliation unknown', family: 'unknown', primary: true },
    { code: 'a', label: 'Assumed friend', meaning: 'Probably friendly, not confirmed', family: 'friendly', primary: false },
    { code: 's', label: 'Suspect', meaning: 'Probably hostile, not confirmed', family: 'hostile', primary: false },
    { code: 'j', label: 'Joker', meaning: 'Friendly playing hostile (exercise)', family: 'hostile', primary: false },
    { code: 'k', label: 'Faker', meaning: 'Friendly posing as hostile (exercise)', family: 'hostile', primary: false },
    { code: 'p', label: 'Pending', meaning: 'Not yet evaluated', family: 'other', primary: false },
    { code: 'o', label: 'None', meaning: 'No affiliation', family: 'other', primary: false },
];

export const FAMILY_COLORS: Record<AffiliationFamily, string> = {
    friendly: '#80E0FF',
    hostile: '#FF8080',
    neutral: '#AAFFAA',
    unknown: '#FFFF80',
    other: '#AAAAAA',
};

export const FAMILY_NAMES: Record<AffiliationFamily, string> = {
    friendly: 'blue',
    hostile: 'red',
    neutral: 'green',
    unknown: 'yellow',
    other: 'gray',
};

export function affiliation(code: string | undefined): Affiliation | undefined {
    return AFFILIATIONS.find((aff) => aff.code === code);
}

/** Affiliation code carried by a CoT Atom type or numeric SIDC */
export function affiliationOf(type: string | undefined): string | undefined {
    if (!type) return undefined;

    if (Type2525.isNumericSIDCConvertable(type)) {
        // Digit 2 is the context - the identity alone is digit 3
        return SID_REVERSE_MAP[`0${type.charAt(3)}`];
    }

    const match = type.match(/^a-([a-z])(-|$)/);
    return match && affiliation(match[1]) ? match[1] : undefined;
}

/** The same type with its affiliation swapped - types with no affiliation are returned unchanged */
export function withAffiliation(type: string, code: string): string {
    if (Type2525.isNumericSIDCConvertable(type)) {
        const sid = SID_MAP[code.toUpperCase()] || '01';
        return type.substring(0, 3) + sid.charAt(1) + type.substring(4);
    }

    return type.replace(/^a-[a-z]-/, `a-${code}-`).replace(/^a-[a-z]$/, `a-${code}`);
}

/** 2525E Status / Operational Condition - digit index 6 of the numeric SIDC */
export const STATUS_OPTIONS = [
    { value: '0', label: 'Present' },
    { value: '1', label: 'Planned' },
    { value: '2', label: 'Fully capable' },
    { value: '3', label: 'Damaged' },
    { value: '4', label: 'Destroyed' },
    { value: '5', label: 'Full to capacity' },
];

export function statusOf(type: string | undefined): string {
    if (!type || !Type2525.isNumericSIDCConvertable(type)) return '0';
    return STATUS_OPTIONS.some((opt) => opt.value === type[6]) ? type[6] : '0';
}

export function withStatus(type: string, status: string): string {
    if (!Type2525.isNumericSIDCConvertable(type)) return type;
    return type.substring(0, 6) + status + type.substring(7);
}

/** CoT types that draw as a plain marker rather than a symbol */
export const DOT_TYPES = ['u-d-p', 'b-m-p-s-m'];

export function isTyped(type: string | undefined): boolean {
    return !!type && !DOT_TYPES.includes(type) && !type.startsWith('u-');
}

export function isIconsetIcon(icon: string | undefined): boolean {
    return !!icon && icon.includes(':') && !/^2525[bcde]:/i.test(icon);
}

export function markerOf(properties: Pick<Feature['properties'], 'type' | 'icon'>): Marker {
    if (isIconsetIcon(properties.icon)) return 'icon';
    if (!isTyped(properties.type)) return 'dot';
    return 'symbol';
}

/** The read-only code shown under Symbol details */
export function symbolCode(type: string | undefined): string | undefined {
    if (!type) return undefined;
    if (Type2525.isNumericSIDCConvertable(type)) return type;

    try {
        if (Type2525.is2525BConvertable(type)) return Type2525.to2525B(type);
    } catch {
        // Not every Atom type has a 2525B equivalent
    }

    return undefined;
}

export const SYMBOL_SET_LABELS: Record<string, string> = {
    '01': 'Air',
    '02': 'Air missiles',
    '05': 'Space',
    '06': 'Space missiles',
    '10': 'Land units',
    '11': 'Civilian units',
    '15': 'Land equipment',
    '20': 'Installations',
    '25': 'Control measures',
    '27': 'Dismounted individuals',
    '30': 'Sea surface',
    '35': 'Sea subsurface',
    '36': 'Mine warfare',
    '40': 'Activities & incidents',
    '45': 'Weather - atmospheric',
    '46': 'Weather - oceanographic',
    '47': 'Weather - space',
    '50': 'SIGINT - space',
    '51': 'SIGINT - air',
    '52': 'SIGINT - land',
    '53': 'SIGINT - surface',
    '54': 'SIGINT - subsurface',
    '60': 'Cyberspace',
};

/** Symbol sets listed up front - the rest sit behind "More symbol sets" */
export const PRIMARY_SYMBOL_SETS = ['10', '15', '20', '01', '30', '35', '40', '25'];

export function symbolSetLabel(id: string, fallback?: string): string {
    return SYMBOL_SET_LABELS[id] || fallback || id;
}

export function symbolSetOf(type: string | undefined): string | undefined {
    if (!type || !Type2525.isNumericSIDCConvertable(type)) return undefined;
    return type.substring(4, 6);
}

/**
 * Split a resolved type name into its most specific level and the path above
 * it - 2525B names are slash separated ("Gnd/Combat/Infantry/Troops (Open)"),
 * 2525E names dash separated ("Infantry - Mechanized")
 */
export function splitTypeName(type: string | undefined, name: string | undefined): { title: string; path: string[] } {
    if (!name || name === type) return { title: name || type || '', path: [] };

    const parts = name.includes('/') ? name.split('/') : name.split(' - ');
    const trimmed = parts.map((part) => part.trim()).filter(Boolean);

    const path = trimmed.slice(0, -1);
    const set = symbolSetOf(type);
    if (set) path.unshift(symbolSetLabel(set));

    return {
        title: trimmed[trimmed.length - 1] || name,
        path
    };
}

export const COLOR_PRESETS = [
    { hex: '#FFFFFF', label: 'White' },
    { hex: '#FF4D4D', label: 'Red' },
    { hex: '#FF8C1A', label: 'Orange' },
    { hex: '#FFD21A', label: 'Yellow' },
    { hex: '#4DD24D', label: 'Green' },
    { hex: '#4D8CFF', label: 'Blue' },
    { hex: '#B04DFF', label: 'Purple' },
];

export function colorLabel(hex: string | undefined): string {
    if (!hex) return 'White';
    const preset = COLOR_PRESETS.find((color) => color.hex.toLowerCase() === hex.toLowerCase());
    return preset ? preset.label : hex.toUpperCase();
}

export interface AppearanceDraft {
    /** Unset for an untyped point */
    type?: string;
    affiliation: string;
    marker: Marker;
    /** Iconset icon key - only applied under the `icon` marker */
    icon?: string;
    color: string;
    opacity: number;
}

export function draftFrom(properties: Feature['properties']): AppearanceDraft {
    const typed = isTyped(properties.type);

    return {
        type: typed ? properties.type : undefined,
        affiliation: affiliationOf(properties.type) || 'u',
        marker: markerOf(properties),
        icon: isIconsetIcon(properties.icon) ? properties.icon : undefined,
        color: properties['marker-color'] || '#FFFFFF',
        opacity: properties['marker-opacity'] ?? 1,
    };
}

/**
 * Properties to persist for a draft. A MIL-STD symbol is a pure function of the
 * type so no icon is stored for a SIDC, and a dot is the untyped Custom Point
 * TAK clients draw as a plain marker
 */
export function applyAppearance(
    current: Feature['properties'],
    draft: AppearanceDraft
): Feature['properties'] {
    const properties = { ...current };

    // The type is authoritative - a stale milicon would otherwise be preferred
    // by node-cot's from_geojson when the Feature is converted to a CoT
    delete properties.milicon;

    properties['marker-opacity'] = draft.opacity;

    if (draft.marker === 'dot') {
        properties.type = 'u-d-p';
        delete properties.icon;
        properties['marker-color'] = draft.color;
        return properties;
    }

    if (draft.type) {
        properties.type = draft.type;
    } else if (!isTyped(properties.type)) {
        properties.type = 'u-d-p';
    }

    if (draft.marker === 'icon' && draft.icon) {
        properties.icon = draft.icon;
        properties['marker-color'] = draft.color;
        return properties;
    }

    if (Type2525.isNumericSIDCConvertable(properties.type) || !isTyped(properties.type)) {
        delete properties.icon;
    } else {
        properties.icon = properties.type;
    }

    // Spritesheet icons are tinted by marker-color - white leaves the
    // affiliation frame colour as drawn
    properties['marker-color'] = '#FFFFFF';

    return properties;
}

export interface AppearanceSummary {
    title: string;
    subtitle: string;
}

/**
 * Two line summary of a Feature's appearance - "Hostile · Infantry" over
 * "Military symbol · red from Hostile"
 */
export function describeAppearance(
    properties: Feature['properties'],
    typeName?: string,
    iconName?: string
): AppearanceSummary {
    const marker = markerOf(properties);
    const aff = affiliation(affiliationOf(properties.type));
    const typed = isTyped(properties.type);

    const status = statusOf(properties.type);
    const statusLabel = status !== '0' ? STATUS_OPTIONS.find((opt) => opt.value === status)?.label : undefined;

    const title = typed
        ? [aff?.label, splitTypeName(properties.type, typeName).title, statusLabel].filter(Boolean).join(' · ')
        : 'Unknown point';

    let subtitle: string;

    if (marker === 'icon') {
        subtitle = ['Custom icon', iconName].filter(Boolean).join(' · ');
    } else if (marker === 'dot') {
        subtitle = `Dot · ${colorLabel(properties['marker-color'])}`;
    } else if (aff) {
        subtitle = `Military symbol · ${FAMILY_NAMES[aff.family]} from ${aff.label}`;
    } else {
        subtitle = 'Military symbol';
    }

    return { title, subtitle };
}

export const STROKE_STYLES = ['solid', 'dashed', 'dotted', 'outlined'];

/** Stroke & fill styling for lines and polygons */
export interface StyleDraft {
    stroke: string;
    strokeStyle: string;
    strokeWidth: number;
    strokeOpacity: number;
    fill: string;
    fillOpacity: number;
}

export function styleFrom(properties: Feature['properties']): StyleDraft {
    return {
        stroke: properties.stroke || '#FFFFFF',
        strokeStyle: properties['stroke-style'] || 'solid',
        strokeWidth: properties['stroke-width'] ?? 1,
        strokeOpacity: properties['stroke-opacity'] ?? 1,
        fill: properties.fill || properties.stroke || '#FFFFFF',
        fillOpacity: properties['fill-opacity'] ?? 1,
    };
}

export function applyStyle(
    current: Feature['properties'],
    geometry: string,
    style: StyleDraft
): Feature['properties'] {
    const properties = { ...current };

    properties.stroke = style.stroke;
    properties['stroke-style'] = style.strokeStyle;
    properties['stroke-width'] = style.strokeWidth;
    properties['stroke-opacity'] = style.strokeOpacity;

    if (geometry === 'Polygon' || geometry === 'MultiPolygon') {
        properties.fill = style.fill;
        properties['fill-opacity'] = style.fillOpacity;
    }

    return properties;
}

export function geometryLabel(geometry: string, type?: string): string {
    if (type === 'b-m-r') return 'Route';
    if (type === 'u-d-c-c') return 'Circle';

    switch (geometry) {
        case 'LineString':
        case 'MultiLineString':
            return 'Line';
        case 'Polygon':
        case 'MultiPolygon':
            return 'Polygon';
        default:
            return 'Shape';
    }
}

/** "Polygon" over "Stroke Red · Fill Blue" */
export function describeStyle(geometry: string, properties: Feature['properties']): AppearanceSummary {
    const style = styleFrom(properties);
    const parts = [`Stroke ${colorLabel(style.stroke)}`];

    if (style.strokeStyle !== 'solid') parts.push(style.strokeStyle);

    if (geometry === 'Polygon' || geometry === 'MultiPolygon') {
        parts.push(style.fillOpacity === 0 ? 'No fill' : `Fill ${colorLabel(style.fill)}`);
    }

    return {
        title: geometryLabel(geometry, properties.type),
        subtitle: parts.join(' · ')
    };
}

/** 2525E Context - digit index 2 of the numeric SIDC */
export const CONTEXT_OPTIONS = [
    { value: '0', label: 'Reality', meaning: 'Real world' },
    { value: '1', label: 'Exercise', meaning: 'Training exercise' },
    { value: '2', label: 'Simulation', meaning: 'Simulated' },
];

export function contextOf(type: string | undefined): string {
    if (!type || !Type2525.isNumericSIDCConvertable(type)) return '0';
    return CONTEXT_OPTIONS.some((opt) => opt.value === type[2]) ? type[2] : '0';
}

export function withContext(type: string, context: string): string {
    if (!Type2525.isNumericSIDCConvertable(type)) return type;
    return type.substring(0, 2) + context + type.substring(3);
}

/** Headquarters / Task Force / Feint-Dummy - digit index 7, a bit field */
export interface HqTfDummy {
    headquarters: boolean;
    taskForce: boolean;
    dummy: boolean;
}

export const HQ_TF_DUMMY_LABELS: Record<keyof HqTfDummy, string> = {
    headquarters: 'Headquarters',
    taskForce: 'Task force',
    dummy: 'Feint / Dummy',
};

export function hqTfDummyOf(type: string | undefined): HqTfDummy {
    const digit = type && Type2525.isNumericSIDCConvertable(type) ? parseInt(type[7]) : 0;
    const bits = isNaN(digit) ? 0 : digit;

    return {
        dummy: (bits & 1) !== 0,
        headquarters: (bits & 2) !== 0,
        taskForce: (bits & 4) !== 0,
    };
}

export function withHqTfDummy(type: string, flags: HqTfDummy): string {
    if (!Type2525.isNumericSIDCConvertable(type)) return type;

    const bits = (flags.dummy ? 1 : 0) | (flags.headquarters ? 2 : 0) | (flags.taskForce ? 4 : 0);
    return type.substring(0, 7) + String(bits) + type.substring(8);
}

/** Indicators a symbol set's frame can carry - units take all three, equipment and installations only a dummy */
export function hqTfDummyOptions(symbolset: string | undefined): Array<keyof HqTfDummy> {
    switch (symbolset) {
        case '10':
        case '11':
            return ['headquarters', 'taskForce', 'dummy'];
        case '15':
        case '20':
            return ['dummy'];
        default:
            return [];
    }
}

/** Echelon / Mobility / Towed Array / Leadership amplifier - digit indexes 8-9 */
export interface AmplifierOption {
    value: string;
    label: string;
}

const NO_AMPLIFIER: AmplifierOption = { value: '00', label: 'None' };

export const ECHELONS: AmplifierOption[] = [
    NO_AMPLIFIER,
    { value: '11', label: 'Team / Crew' },
    { value: '12', label: 'Squad' },
    { value: '13', label: 'Section' },
    { value: '14', label: 'Platoon / Detachment' },
    { value: '15', label: 'Company / Battery / Troop' },
    { value: '16', label: 'Battalion / Squadron' },
    { value: '17', label: 'Regiment / Group' },
    { value: '18', label: 'Brigade' },
    { value: '21', label: 'Division' },
    { value: '22', label: 'Corps / MEF' },
    { value: '23', label: 'Army' },
    { value: '24', label: 'Army Group / Front' },
    { value: '25', label: 'Region / Theater' },
    { value: '26', label: 'Command' },
];

export const MOBILITIES: AmplifierOption[] = [
    NO_AMPLIFIER,
    { value: '31', label: 'Wheeled, limited cross country' },
    { value: '32', label: 'Wheeled, cross country' },
    { value: '33', label: 'Tracked' },
    { value: '34', label: 'Wheeled and tracked' },
    { value: '35', label: 'Towed' },
    { value: '36', label: 'Rail' },
    { value: '37', label: 'Pack animals' },
    { value: '41', label: 'Over snow (prime mover)' },
    { value: '42', label: 'Sled' },
    { value: '51', label: 'Barge' },
    { value: '52', label: 'Amphibious' },
];

export const TOWED_ARRAYS: AmplifierOption[] = [
    NO_AMPLIFIER,
    { value: '61', label: 'Short towed array' },
    { value: '62', label: 'Long towed array' },
];

export const LEADERSHIP: AmplifierOption[] = [
    NO_AMPLIFIER,
    { value: '71', label: 'Leader' },
    { value: '72', label: 'Deputy' },
];

export function amplifierOptions(symbolset: string | undefined): { label: string; options: AmplifierOption[] } | undefined {
    switch (symbolset) {
        case '10':
        case '11':
            return { label: 'Echelon', options: ECHELONS };
        case '15':
            return { label: 'Mobility', options: MOBILITIES };
        case '30':
        case '35':
            return { label: 'Towed array', options: TOWED_ARRAYS };
        case '27':
            return { label: 'Leadership', options: LEADERSHIP };
        default:
            return undefined;
    }
}

export function amplifierOf(type: string | undefined): string {
    if (!type || !Type2525.isNumericSIDCConvertable(type)) return '00';
    return type.substring(8, 10);
}

export function withAmplifier(type: string, code: string): string {
    if (!Type2525.isNumericSIDCConvertable(type)) return type;
    return type.substring(0, 8) + code + type.substring(10);
}

/**
 * A freshly picked symbol inherits the frame fields of the one it replaces:
 * context always, and status / indicators / amplifier when the symbol set is
 * the same so they still mean something
 */
export function carryFrame(from: string | undefined, to: string): string {
    if (!from || !Type2525.isNumericSIDCConvertable(from) || !Type2525.isNumericSIDCConvertable(to)) return to;

    let next = withContext(to, contextOf(from));

    if (symbolSetOf(from) === symbolSetOf(to)) {
        next = withStatus(next, statusOf(from));
        next = withHqTfDummy(next, hqTfDummyOf(from));
        next = withAmplifier(next, amplifierOf(from));
    }

    return next;
}
