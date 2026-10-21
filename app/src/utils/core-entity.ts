import Type2525 from '@tak-ps/node-cot/2525';

export type CoreEntityKind = 'event' | 'device';

export type CoreEntityRef = {
    kind: CoreEntityKind;
    id: string;
};

type EntityLink = {
    type?: string;
    event?: string;
    device?: string;
};

const LABELS: Record<CoreEntityKind, string> = {
    event: 'Event',
    device: 'Device',
};

const ROUTE_NAMES: Record<CoreEntityKind, string> = {
    event: 'home-menu-core-entity',
    device: 'home-menu-core-device',
};

/**
 * Core Entity a CoT is the projection of - carried on the `p` (parent) Link
 * the API attaches when it broadcasts an Event or Device
 */
export function entityLink(links: Array<EntityLink> | undefined): CoreEntityRef | undefined {
    for (const link of links || []) {
        if (link.type === 'core-event' && link.event) return { kind: 'event', id: link.event };
        if (link.type === 'core-device' && link.device) return { kind: 'device', id: link.device };
    }

    return undefined;
}

export function entityLabel(entity: CoreEntityRef): string {
    return LABELS[entity.kind];
}

export function entityRoute(entity: CoreEntityRef): string {
    return `/${entity.kind}/${entity.id}`;
}

export function entityRouteName(entity: CoreEntityRef): string {
    return ROUTE_NAMES[entity.kind];
}

type MarkerSource = {
    type: string;
    name: string;
    remarks: string;
    style: {
        icon?: string;
        'marker-color'?: string;
        'marker-opacity'?: number;
    };
};

/**
 * Mirror a saved Entity change onto its map marker's properties so it updates
 * immediately rather than on the next Entity CoT broadcast
 */
export function entityMarkerProperties<T extends Record<string, unknown>>(current: T, entity: MarkerSource): T {
    const properties: Record<string, unknown> = { ...current };

    properties.type = entity.type;
    properties.callsign = entity.name;
    properties.remarks = entity.remarks;

    if (Type2525.isNumericSIDCConvertable(entity.type)) {
        properties.milicon = { id: entity.type };
    } else {
        delete properties.milicon;
    }

    // The derived icon sticks once set - strip it so it re-derives from
    // the new type unless the Entity style pins an explicit icon
    if (entity.style.icon) {
        properties.icon = entity.style.icon;
    } else {
        delete properties.icon;
    }

    for (const key of ['marker-color', 'marker-opacity'] as const) {
        if (entity.style[key] !== undefined) {
            properties[key] = entity.style[key];
        } else {
            delete properties[key];
        }
    }

    return properties as T;
}
