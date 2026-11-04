<template>
    <MenuTemplate
        name='Feature'
        :none='!feature'
        :scroll='false'
    >
        <template
            v-if='feature'
            #header
        >
            <div class='flex-shrink-0'>
                <FeatureIcon
                    :key='iconKey'
                    :size='32'
                    :feature='feature'
                />
            </div>
            <div
                class='flex-grow-1 mx-2'
                style='min-width: 0'
            >
                <CopyField
                    :model-value='featureTitle'
                    :minheight='44'
                />
            </div>
        </template>

        <div
            v-if='feature'
            class='d-flex flex-column h-100'
            style='min-height: 0;'
        >
            <div class='feat-actions d-flex align-items-center flex-nowrap px-2 py-1 border-bottom cloudtak-header flex-shrink-0'>
                <TablerIconButton
                    title='Zoom To'
                    @click='zoomTo'
                >
                    <IconZoomPan
                        :size='actionIconSize'
                        stroke='1'
                    />
                </TablerIconButton>

                <TablerIconButton
                    :title='isNavigating ? "End Navigation" : "Navigate"'
                    @click='toggleNavigation'
                >
                    <IconNavigationFilled
                        v-if='isNavigating'
                        :size='actionIconSize'
                        stroke='1'
                        class='text-blue'
                    />
                    <IconNavigation
                        v-else
                        :size='actionIconSize'
                        stroke='1'
                    />
                </TablerIconButton>

                <TablerIconButton
                    v-if='overlay && ["basemap", "overlay"].includes(overlay.mode) && overlay.actions.feature.includes("fetch")'
                    title='Cut to Marker'
                    @click='cutFeature'
                >
                    <IconScissors
                        :size='actionIconSize'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>

            <div
                class='overflow-auto overflow-x-hidden flex-grow-1'
                style='min-height: 0;'
            >
                <div class='pt-1'>
                    <Coordinate
                        :key='featureKey'
                        :label='feature.geometry.type === "Point" ? "Location" : "Center"'
                        :model-value='center'
                    />

                    <PropertyElevation
                        v-if='center.length > 2'
                        :key='featureKey'
                        label='Elevation'
                        :elevation='center[2]'
                    />

                    <LineLength
                        v-if='feature.geometry.type === "LineString"'
                        :key='featureKey'
                        :geometry='feature.geometry'
                    />

                    <PolygonArea
                        v-if='feature.geometry.type === "Polygon"'
                        :key='featureKey'
                        :geometry='feature.geometry'
                    />
                </div>

                <PropertyRemarks
                    v-if='htmlDescription'
                    label='Description'
                    :model-value='htmlDescription'
                    :display='htmlDisplay'
                />
                <PropertyRemarks
                    v-else-if='description'
                    label='Description'
                    :model-value='description'
                />

                <PropertyRemarks
                    v-if='remarks'
                    :model-value='remarks'
                />

                <PropertyTabs
                    v-model='mode'
                    :tabs='modeOptions'
                    class='mt-2'
                />

                <div v-if='mode === "default"'>
                    <PropertySection
                        label='Attributes'
                        :count='attributes.length'
                    >
                        <KeyValueRow
                            v-for='entry of attributes'
                            :key='entry.name'
                            :name='entry.name'
                            :value='entry.value'
                        >
                            <template
                                v-if='entry.url'
                                #actions
                            >
                                <a
                                    :href='entry.url'
                                    target='_blank'
                                    rel='noopener'
                                    title='Open Link'
                                    class='d-flex align-items-center flex-shrink-0 text-reset'
                                >
                                    <IconExternalLink
                                        :size='18'
                                        stroke='1.5'
                                    />
                                </a>
                            </template>
                        </KeyValueRow>

                        <div
                            v-if='!attributes.length'
                            class='text-muted text-center user-select-none py-2'
                        >
                            No Attributes
                        </div>
                    </PropertySection>
                </div>
                <div
                    v-else-if='mode === "debug"'
                    class='px-2 py-2'
                >
                    <CopyField
                        mode='pre'
                        :model-value='JSON.stringify(feature, null, 4)'
                    />
                </div>
            </div>
        </div>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, computed, watch, onMounted } from 'vue';
import { useMapStore } from '../../../stores/map.ts';
import type { LngLatLike, MapGeoJSONFeature } from 'maplibre-gl';
import type { Feature } from 'geojson';
import pointOnFeature from '@turf/point-on-feature';
import Handlebars from 'handlebars';
import { server, getRuntimeToken } from '../../../std.ts';
import MenuTemplate from '../util/MenuTemplate.vue';
import FeatureIcon from '../util/FeatureIcon.vue';
import Coordinate from '../util/Coordinate.vue';
import CopyField from '../util/CopyField.vue';
import KeyValueRow from '../util/KeyValueRow.vue';
import LineLength from '../util/LineLength.vue';
import PolygonArea from '../util/PolygonArea.vue';
import PropertySection from '../util/PropertySection.vue';
import PropertyTabs, { type PropertyTab } from '../util/PropertyTabs.vue';
import PropertyElevation from '../Property/PropertyElevation.vue';
import PropertyRemarks from '../Property/PropertyRemarks.vue';
import { cutOverlayFeature, getFeatureOverlay } from '../util/featureCut.ts';
import { featureHtmlDescription, proxyHtmlImages } from '../util/proxyImages.ts';
import {
    TablerIconButton
} from '@tak-ps/vue-tabler';
import {
    IconScissors,
    IconZoomPan,
    IconExternalLink,
    IconNavigation,
    IconNavigationFilled
} from '@tabler/icons-vue';

const mapStore = useMapStore();

const props = defineProps<{
    feat?: Feature | MapGeoJSONFeature
}>();

const feature = computed(() => {
    if (props.feat) return props.feat;
    return mapStore.viewedFeature;
})

const mode = ref('default');
const actionIconSize = 28;

const modeOptions: Array<PropertyTab> = [
    { value: 'default', label: 'Details' },
    { value: 'debug', label: 'Debug' },
];

const token = ref<string | null | undefined>(undefined);

onMounted(async () => {
    token.value = (await getRuntimeToken()) ?? null;
});

const overlay = computed(() => getFeatureOverlay(feature.value));

const titleTemplate = ref<string | null>(null);

watch(overlay, async (ov) => {
    titleTemplate.value = null;
    if (!ov || !ov.mode_id || !['basemap', 'overlay'].includes(ov.mode)) return;

    const { data } = await server.GET('/api/basemap/{:basemapid}', {
        params: { path: { ':basemapid': Number(ov.mode_id) } }
    });

    if (data && typeof data === 'object' && 'title' in data && data.title) {
        titleTemplate.value = data.title;
    }
}, { immediate: true });

const featureTitle = computed(() => {
    if (!feature.value) return 'No Name';
    const props = feature.value.properties || {};

    if (titleTemplate.value) {
        try {
            let tmpl = titleTemplate.value;
            // Bare property name (e.g. "callsign") => wrap as handlebars expression
            if (/^[a-zA-Z0-9_]+$/.test(tmpl)) {
                tmpl = `{{${tmpl}}}`;
            }
            const result = Handlebars.compile(tmpl)(props);
            if (result && result.trim().length > 0) return result;
        } catch {
            // Fall through to default
        }
    }

    return props.name || props.callsign || 'No Name';
});

const featureKey = computed(() => String(feature.value?.id ?? featureTitle.value));

const iconKey = computed(() => {
    const p = feature.value?.properties || {};
    return `${featureKey.value}-${p.type ?? ''}-${p.icon ?? ''}`;
});

const center = computed(() => {
    if (!feature.value) return [0, 0];
    return pointOnFeature(feature.value).geometry.coordinates;
});

const htmlDescription = computed(() => featureHtmlDescription(feature.value?.properties));

const htmlDisplay = computed(() => {
    // Empty until the token is read so images are never requested without it
    if (token.value === undefined || !htmlDescription.value) return '';
    return proxyHtmlImages(htmlDescription.value, token.value);
});

const description = computed(() => stringProperty('description'));
const remarks = computed(() => stringProperty('remarks'));

function stringProperty(name: string): string | null {
    const value = feature.value?.properties?.[name];
    return typeof value === 'string' && value.trim() ? value : null;
}

const STYLE_PROPERTIES = new Set([
    'marker-color',
    'marker-stroke-color',
    'marker-opacity',
    'marker-size',
    'marker-symbol',
    'stroke',
    'stroke-opacity',
    'stroke-width',
    'stroke-style',
    'fill',
    'fill-opacity'
]);

// Shown in the header & standalone sections above the attributes
const DISPLAYED_PROPERTIES = new Set(['name', 'description', 'remarks']);

const attributes = computed(() => {
    const properties = feature.value?.properties || {};

    return Object.keys(properties)
        .filter((name) => !STYLE_PROPERTIES.has(name) && !DISPLAYED_PROPERTIES.has(name))
        .map((name) => {
            const raw = properties[name];
            const url = typeof raw === 'string' && /^https?:\/\//.test(raw) ? raw : undefined;

            return {
                name,
                url,
                value: raw !== null && typeof raw === 'object' ? JSON.stringify(raw) : String(raw ?? '')
            };
        });
});

async function cutFeature() {
    await cutOverlayFeature(mapStore, feature.value);
}

const isNavigating = computed(() => {
    const dest = mapStore.navigation.destination;
    return mapStore.navigation.active
        && !mapStore.navigation.cotId
        && !!dest
        && dest[0] === center.value[0]
        && dest[1] === center.value[1];
});

function toggleNavigation() {
    if (isNavigating.value) {
        mapStore.stopNavigation();
    } else if (feature.value) {
        mapStore.navigateTo(center.value, featureTitle.value);
    }
}

function zoomTo() {
    mapStore.map.flyTo({
        center: center.value as LngLatLike,
        zoom: 14
    })
}
</script>

<style scoped>
.feat-actions :deep(svg) {
    display: block;
}
</style>
