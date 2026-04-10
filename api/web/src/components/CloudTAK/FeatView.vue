<template>
    <div
        v-if='feature'
        class='d-flex flex-column'
        style='height: 100%;'
    >
        <div
            class='col-12 border-light border-bottom flex-shrink-0'
            style='
                height: 90px;
                border-radius: 0px;
            '
        >
            <div class='col-12 card-header px-1 py-2'>
                <div
                    class='card-title mx-2 text-truncate'
                    style='width: 280px'
                    v-text='feature.properties?.name || "No Name"'
                />
            </div>
            <div class='col-12 btn-list my-2 d-flex align-items-center mx-2'>
                <TablerIconButton
                    title='Zoom To'
                    @click='zoomTo'
                >
                    <IconZoomPan
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>

                <TablerIconButton
                    v-if='overlay && ["basemap", "overlay"].includes(overlay.mode) && overlay.actions.feature.includes("fetch")'
                    title='Cut to Marker'
                    @click='cutFeature'
                >
                    <IconScissors
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
                <div
                    class='ms-auto'
                    style='margin-right: 14px;'
                >
                    <TablerIconButton
                        v-if='mode === "default"'
                        title='Raw View'
                        @click='mode = "raw"'
                    >
                        <IconCode
                            :size='32'
                            stroke='1'
                        />
                    </TablerIconButton>

                    <TablerIconButton
                        v-if='mode === "raw"'
                        title='Default View'
                        @click='mode = "default"'
                    >
                        <IconX
                            :size='32'
                            stroke='1'
                        />
                    </TablerIconButton>
                </div>
            </div>
        </div>

        <div
            class='col-12 overflow-auto flex-fill'
            style='min-height: 0'
        >
            <template v-if='mode === "default"'>
                <div class='col-12 px-2 py-2'>
                    <Coordinate v-model='center' />
                </div>

                <div class='col-12 px-2 pb-2'>
                    <div class='col-12'>
                        <IconBlockquote
                            :size='18'
                            stroke='1'
                            color='#6b7990'
                            class='ms-2 me-1'
                        />
                        <label class='subheader user-select-none'>Remarks</label>
                    </div>
                    <div
                        v-if='htmlDescription'
                        class='mx-2'
                    >
                        <CopyField
                            :model-value='htmlDescription'
                            :rows='2'
                            mode='text'
                        />
                    </div>
                    <div
                        v-else
                        class='table-responsive rounded mx-2'
                    >
                        <table class='table card-table table-hover table-vcenter datatable'>
                            <thead>
                                <tr>
                                    <th>Key</th>
                                    <th>Value</th>
                                </tr>
                            </thead>
                            <tbody class='cloudtak-accent'>
                                <template v-if='feature.properties'>
                                    <tr
                                        v-for='prop of Object.keys(feature.properties)'
                                        :key='prop'
                                    >
                                        <td v-text='prop' />
                                        <td>
                                            <a
                                                v-if='typeof feature.properties[prop] === "string" && feature.properties[prop].startsWith("http")'
                                                :href='feature.properties[prop]'
                                                target='_blank'
                                                v-text='feature.properties[prop]'
                                            />
                                            <span
                                                v-else
                                                v-text='feature.properties[prop]'
                                            />
                                        </td>
                                    </tr>
                                </template>
                            </tbody>
                        </table>
                    </div>
                </div>
            </template>
            <template v-else-if='mode === "raw"'>
                <pre v-text='feature' />
            </template>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import { useMapStore } from '../../stores/map.ts';
import type { LngLatLike, MapGeoJSONFeature } from 'maplibre-gl';
import type { Feature } from 'geojson';
import pointOnFeature from '@turf/point-on-feature';
import Coordinate from './util/Coordinate.vue';
import CopyField from './util/CopyField.vue';
import { cutOverlayFeature, getFeatureOverlay } from './util/featureCut.ts';
import {
    TablerIconButton
} from '@tak-ps/vue-tabler';
import {
    IconX,
    IconScissors,
    IconZoomPan,
    IconBlockquote,
    IconCode
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

const overlay = computed(() => getFeatureOverlay(mapStore, feature.value));

const center = computed(() => {
    if (!feature.value) return [0, 0];
    return pointOnFeature(feature.value).geometry.coordinates;
});

const htmlDescription = computed(() => {
    if (!feature.value || !feature.value.properties?.description) return null;
    try {
        const desc = JSON.parse(feature.value.properties.description);
        if (desc['@type'] === 'html' && desc.value) {
            return desc.value;
        }
    } catch {
        return null;
    }
    return null;
});

async function cutFeature() {
    await cutOverlayFeature(mapStore, feature.value);
}

function zoomTo() {
    mapStore.map.flyTo({
        center: center.value as LngLatLike,
        zoom: 14
    })
}
</script>
