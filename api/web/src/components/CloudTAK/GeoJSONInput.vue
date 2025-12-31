<template>
    <TablerModal size='lg'>
        <div class='modal-status bg-red' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='emit("close")'
        />
        <div class='modal-header text-white'>
            <div class='d-flex align-items-center'>
                <IconFileImport
                    :size='28'
                    stroke='1'
                />
                <span class='mx-2'>Import GeoJSON to Editable Features</span>
            </div>
        </div>
        <div class='modal-body text-white'>
            <TablerLoading v-if='loading' />
            <div
                v-else-if='!feats.length'
                class='row mx-2'
            >
                <div class='col-12'>
                    <TablerFileInput
                        type='file'
                        accept='.json, .geojson'
                        label='File'
                        @change='processUpload($event)'
                    />
                </div>

                <div class='col-12 pt-3'>
                    <TablerInlineAlert
                        v-if='error'
                        title='An Error Occurred'
                        :description='error.message'
                    />
                </div>

                <div class='col-12 pt-3'>
                    <TablerInlineAlert
                        title='FYI'
                        description='Large GeoJSON files should be uploaded via the Imports menu'
                    />
                </div>

                <div class='col-12 pt-3'>
                    <TablerButton
                        class='btn-primary w-100'
                        :disabled='!file'
                        @click='uploadGeoJSON'
                    >
                        Upload
                    </TablerButton>
                </div>
            </div>
            <div
                v-else-if='feats.length'
                class='row mx-2'
            >
                <div class='col-12 pt-3'>
                    <label class='mx-2 user-select-none'>Features To Import:</label>

                    <div
                        v-if='feats.length !== 0'
                        class='col-12 overflow-auto'
                        style='
                            max-height: 40vh;
                        '
                    >
                        <FeatureRow
                            v-for='feat of feats'
                            :key='feat.id'
                            :feature='feat'
                            :hover='false'
                            :delete-button='false'
                        />
                    </div>
                    <TablerNone
                        v-else
                        :compact='true'
                        :create='false'
                        label='Features'
                    />
                </div>

                <div class='col-12 pt-3'>
                    <TablerButton
                        class='btn-primary w-100'
                        @click='saveToMap'
                    >
                        Save To Map
                    </TablerButton>
                </div>
            </div>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import {
    TablerNone,
    TablerModal,
    TablerLoading,
    TablerButton,
    TablerInlineAlert,
    TablerFileInput,
} from '@tak-ps/vue-tabler';
import type CoT from '../../base/cot.ts';
import { useMapStore } from '../../stores/map.ts';
import { normalize_geojson } from '@tak-ps/node-cot/normalize_geojson';
import {
    IconFileImport,
} from '@tabler/icons-vue';
import type { LngLatBoundsLike } from 'maplibre-gl';
import FeatureRow from './util/FeatureRow.vue';
import { bbox } from '@turf/bbox';
import type { InputFeature } from '../../types.ts';

const mapStore = useMapStore();

const props = defineProps({
    features: {
        type: Array as () => InputFeature[],
        required: false,
        default: () => []
    }
});

const error = ref<Error | undefined>();
const file = ref<File | undefined>();

const feats = ref<InputFeature[]>(props.features || []);

const emit = defineEmits(['close', 'done']);

const loading = ref(false);

async function processUpload(event: Event) {
    if (!event.target || !(event.target instanceof HTMLInputElement) || !event.target.files) return;
    if (event.target.files.length === 0) return;

    file.value = event.target.files[0];
}

async function uploadGeoJSON() {
    if (!file.value) return;

    loading.value = true;
    feats.value = [];

    const reader = new FileReader();
    reader.readAsText(file.value);

    reader.onload = async (e) => {
        try {
            if (!e.target || !e.target.result) throw new Error('File read error: No content');

            const fc = JSON.parse(String(e.target.result));

            if (!fc || !fc.features || !Array.isArray(fc.features)) {
                throw new Error('Invalid GeoJSON format');
            }

            // TODO Ideally CloudTAK in the future will use CoTs natively so we will
            // Remove this To_GeoJSON conversion

            const name = file.value?.name ? file.value.name.replace(/\..*$/, '') : new Date().toISOString().replace(/T.*/, '') + ' Import';

            for (const feat of fc.features) {
                try {
                    const norm = await normalize_geojson(feat);

                    norm.path = `/${name}/`

                    // TODO Remote once we support the metadata property throughout
                    // @ts-expect-error The "metadata" property is jamming us up - Once we swithc to node-cot this will be solved
                    feats.value.push(norm)
                } catch (err) {
                    console.error('Error normalizing GeoJSON feature:', feat, err);
                }
            }

            loading.value = false;
        } catch (err) {
            loading.value = false;
            error.value = err instanceof Error ? err : new Error(String(err));
        }
    };
}

async function saveToMap() {
    loading.value = true;

    const bounds = bbox({
        type: 'FeatureCollection',
        features: feats.value
    });

    mapStore.map.fitBounds(bounds as LngLatBoundsLike, {
        duration: 0,
        padding: {
            top: 25,
            bottom: 25,
            left: 25,
            right: 25
        }
    });

    const adding: Array<Promise<CoT>> = feats.value.map(feat =>
        mapStore.worker.db.add(JSON.parse(JSON.stringify(feat)), {
            authored: true
        })
    );

    await Promise.all(adding);

    loading.value = false;

    emit('done');
    emit('close');
}
</script>
