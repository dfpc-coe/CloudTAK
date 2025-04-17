<template>
    <div
        class='position-absolute end-0 bottom-0 text-white bg-dark'
        style='
            z-index: 1;
            width: 400px;
            top: 56px;
        '
    >
        <div
            class='col-12 border-light border-bottom sticky-top'
            style='
                height: 90px;
                border-radius: 0px;
            '
        >
            <div class='col-12 card-header px-1 py-2'>
                <div
                    class='card-title mx-2 text-truncate'
                    style='width: 280px'
                    v-text='feat.properties?.name || "No Name"'
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
            class='col-12 overflow-auto'
            style='height: calc(100vh - 90px)'
        >
            <template v-if='mode === "default"'>
                <div class='col-12 px-3 py-2'>
                    <Coordinate v-model='center' />
                </div>

                <div class='col-12 px-3 pb-2'>
                    <label class='subheader'>Remarks</label>
                    <div class='table-responsive rounded mx-2 py-2 px-2'>
                        <table class='table card-table table-hover table-vcenter datatable'>
                            <thead>
                                <tr>
                                    <th>Key</th>
                                    <th>Value</th>
                                </tr>
                            </thead>
                            <tbody class='bg-gray-500'>
                                <template v-if='feat.properties'>
                                    <tr
                                        v-for='prop of Object.keys(feat.properties)'
                                        :key='prop'
                                    >
                                        <td v-text='prop' />
                                        <td>
                                            <a
                                                v-if='typeof feat.properties[prop] === "string" && feat.properties[prop].startsWith("http")'
                                                :href='feat.properties[prop]'
                                                target='_blank'
                                                v-text='feat.properties[prop]'
                                            />
                                            <span
                                                v-else
                                                v-text='feat.properties[prop]'
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
                <pre v-text='feat' />
            </template>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import { useMapStore } from '../../stores/map.ts';
//import Overlay from '../../base/overlay.ts';
import type { LngLatLike, MapGeoJSONFeature } from 'maplibre-gl';
import type { Feature } from 'geojson';
import pointOnFeature from '@turf/point-on-feature';
import Coordinate from './util/Coordinate.vue';
import {
    TablerIconButton
} from '@tak-ps/vue-tabler';
import {
    IconX,
    IconZoomPan,
    IconCode
} from '@tabler/icons-vue';

const mapStore = useMapStore();

const props = defineProps<{
    feat: Feature | MapGeoJSONFeature
}>();

const mode = ref('default');

/*
const overlay = computed<Overlay | null>(() => {
    // @ts-expect-error Doesn't exist in typedef
    const source: number | undefined = Number(props.feat.source);
    if (!source || isNaN(source)) return null
    const ov = mapStore.getOverlayById(source);
    return ov;
})
*/

const center = computed(() => {
    return pointOnFeature(props.feat).geometry.coordinates;
});

function zoomTo() {
    mapStore.map.flyTo({
        center: center.value as LngLatLike,
        zoom: 14
    })
}
</script>
