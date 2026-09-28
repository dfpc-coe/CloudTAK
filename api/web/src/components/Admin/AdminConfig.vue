<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                CloudTAK Settings
            </h3>
        </div>
        <div class='card-body row'>
            <div class='col-12 px-3 pb-2'>
                <TablerInput
                    v-model='filter'
                    icon='search'
                    placeholder='Filter settings...'
                />
            </div>

            <component
                :is='section.component'
                v-for='section in sections'
                v-show='matches(section)'
                :key='section.label'
            />

            <TablerNone
                v-if='!sections.some(matches)'
                label='No Matching Settings'
                :create='false'
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, markRaw } from 'vue';
import type { Component } from 'vue';
import {
    TablerNone,
    TablerInput,
} from '@tak-ps/vue-tabler';
import ConfigLogin from './AdminConfig/ConfigLogin.vue';
import ConfigSearch from './AdminConfig/ConfigSearch.vue';
import ConfigRouting from './AdminConfig/ConfigRouting.vue';
import ConfigMedia from './AdminConfig/ConfigMedia.vue';
import ConfigProxy from './AdminConfig/ConfigProxy.vue';
import ConfigRetention from './AdminConfig/ConfigRetention.vue';
import ConfigNotifications from './AdminConfig/ConfigNotifications.vue';
import ConfigDisplay from './AdminConfig/ConfigDisplay.vue';
import ConfigApplications from './AdminConfig/ConfigApplications.vue';
import ConfigCoreEvents from './AdminConfig/ConfigCoreEvents.vue';
import ConfigGroups from './AdminConfig/ConfigGroups.vue';
import ConfigMap from './AdminConfig/ConfigMap.vue';
import ConfigProvider from './AdminConfig/ConfigProvider.vue';
import ConfigScim from './AdminConfig/ConfigScim.vue';
import ConfigCoturn from './AdminConfig/ConfigCoturn.vue';

type Section = { label: string, keywords: string[], component: Component };

const filter = ref('');

const sections: Section[] = [
    { label: 'Login Page', keywords: ['logo', 'brand', 'background', 'sso', 'oidc', 'passkey', 'token', 'session', 'signup'], component: markRaw(ConfigLogin) },
    { label: 'Search Providers', keywords: ['geocoding', 'geocode', 'arcgis', 'agol', 'esri', 'openstreetmap', 'osm', 'photon'], component: markRaw(ConfigSearch) },
    { label: 'Routing Providers', keywords: ['route', 'directions', 'travel', 'arcgis', 'agol', 'esri'], component: markRaw(ConfigRouting) },
    { label: 'Media Server', keywords: ['video', 'mediamtx', 'stream', 'proxy'], component: markRaw(ConfigMedia) },
    { label: 'Plugin Proxy', keywords: ['whitelist', 'url'], component: markRaw(ConfigProxy) },
    { label: 'Retention', keywords: ['chat', 'import', 'feature', 'deleted', 'days'], component: markRaw(ConfigRetention) },
    { label: 'Notifications', keywords: ['email', 'push', 'sms', 'firebase'], component: markRaw(ConfigNotifications) },
    { label: 'Display Defaults', keywords: ['units', 'coordinate', 'distance', 'speed', 'elevation', 'projection', 'text', 'zoom', 'stale', 'rotation'], component: markRaw(ConfigDisplay) },
    { label: 'External Applications', keywords: ['application', 'link', 'logo'], component: markRaw(ConfigApplications) },
    { label: 'Core Events', keywords: ['event', 'type', 'icon', 'symbol'], component: markRaw(ConfigCoreEvents) },
    { label: 'TAK User Groups', keywords: ['group', 'team', 'colour', 'color'], component: markRaw(ConfigGroups) },
    { label: 'Map Settings', keywords: ['basemap', 'terrain', 'center', 'zoom', 'pitch', 'bearing'], component: markRaw(ConfigMap) },
    { label: 'COTAK OAuth Provider', keywords: ['oauth', 'client', 'secret'], component: markRaw(ConfigProvider) },
    { label: 'SCIM User Provisioning', keywords: ['scim', 'provisioning', 'bearer', 'token'], component: markRaw(ConfigScim) },
    { label: 'CoTURN Server', keywords: ['coturn', 'turn', 'webrtc', 'secret'], component: markRaw(ConfigCoturn) },
];

function matches(section: Section): boolean {
    const terms = filter.value.toLowerCase().split(/\s+/).filter(Boolean);
    const haystack = [section.label, ...section.keywords].join(' ').toLowerCase();

    return terms.every(term => haystack.includes(term));
}
</script>
