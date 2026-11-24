import { markRaw } from 'vue';
import type { Component } from 'vue';
import {
    IconApps,
    IconBell,
    IconCalendarEvent,
    IconClockX,
    IconEye,
    IconKey,
    IconLogin2,
    IconMap,
    IconMapSearch,
    IconPhoneCall,
    IconPlug,
    IconPuzzle,
    IconRoute,
    IconUserCog,
    IconUsersGroup,
    IconVideo,
} from '@tabler/icons-vue';

export type ConfigSection = {
    slug: string;
    label: string;
    keywords: string[];
    icon: Component;
};

export const sections: ConfigSection[] = [
    { slug: 'login', label: 'Login Page', keywords: ['logo', 'brand', 'background', 'sso', 'oidc', 'passkey', 'token', 'session', 'signup'], icon: markRaw(IconLogin2) },
    { slug: 'search', label: 'Search Providers', keywords: ['geocoding', 'geocode', 'arcgis', 'agol', 'esri', 'openstreetmap', 'osm', 'photon'], icon: markRaw(IconMapSearch) },
    { slug: 'routing', label: 'Routing Providers', keywords: ['route', 'directions', 'travel', 'arcgis', 'agol', 'esri'], icon: markRaw(IconRoute) },
    { slug: 'media', label: 'Media Server', keywords: ['video', 'mediamtx', 'stream', 'proxy'], icon: markRaw(IconVideo) },
    { slug: 'plugins', label: 'Plugins', keywords: ['plugin', 'bundle', 'extension'], icon: markRaw(IconPuzzle) },
    { slug: 'proxy', label: 'Plugin Proxy', keywords: ['whitelist', 'url'], icon: markRaw(IconPlug) },
    { slug: 'retention', label: 'Retention', keywords: ['chat', 'import', 'feature', 'deleted', 'days'], icon: markRaw(IconClockX) },
    { slug: 'notifications', label: 'Notifications', keywords: ['email', 'push', 'sms', 'firebase'], icon: markRaw(IconBell) },
    { slug: 'display', label: 'Display Defaults', keywords: ['units', 'coordinate', 'distance', 'speed', 'elevation', 'projection', 'text', 'zoom', 'stale', 'rotation'], icon: markRaw(IconEye) },
    { slug: 'applications', label: 'External Applications', keywords: ['application', 'link', 'logo'], icon: markRaw(IconApps) },
    { slug: 'events', label: 'Core Events', keywords: ['event', 'type', 'icon', 'symbol'], icon: markRaw(IconCalendarEvent) },
    { slug: 'groups', label: 'TAK User Groups', keywords: ['group', 'team', 'colour', 'color'], icon: markRaw(IconUsersGroup) },
    { slug: 'map', label: 'Map Settings', keywords: ['basemap', 'terrain', 'center', 'zoom', 'pitch', 'bearing'], icon: markRaw(IconMap) },
    { slug: 'provider', label: 'COTAK OAuth Provider', keywords: ['oauth', 'client', 'secret'], icon: markRaw(IconKey) },
    { slug: 'scim', label: 'SCIM User Provisioning', keywords: ['scim', 'provisioning', 'bearer', 'token'], icon: markRaw(IconUserCog) },
    { slug: 'coturn', label: 'CoTURN Server', keywords: ['coturn', 'turn', 'webrtc', 'secret'], icon: markRaw(IconPhoneCall) },
];

export function matchesSection(section: ConfigSection, filter: string): boolean {
    const terms = filter.toLowerCase().split(/\s+/).filter(Boolean);
    const haystack = [section.label, ...section.keywords].join(' ').toLowerCase();

    return terms.every(term => haystack.includes(term));
}
