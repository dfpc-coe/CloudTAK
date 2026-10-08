<template>
    <FloatingPane
        :uid='uid'
        @close='emit("close")'
    >
        <template #header>
            <IconFileImport
                :size='24'
                stroke='1'
                class='ms-2'
            />
            <div
                class='mx-2 text-sm text-truncate'
                v-text='"Import GeoJSON to Editable Features"'
            />
        </template>

        <div class='h-100 w-100 overflow-auto'>
            <TablerLoading v-if='loading' />
            <div
                v-else-if='!feats.length'
                class='row mx-2'
            >
                <div class='col-12'>
                    <TablerFileInput
                        :model-value='""'
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
                v-else
                class='row mx-2'
            >
                <div class='col-12 pt-3'>
                    <label class='mx-2 user-select-none'>Features To Import:</label>

                    <div
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
    </FloatingPane>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import {
    TablerLoading,
    TablerButton,
    TablerInlineAlert,
    TablerFileInput,
} from '@tak-ps/vue-tabler';
import { useMapStore } from '../../../stores/map.ts';
import { useFloatStore } from '../../../stores/float.ts';
import type { Pane, PaneGeoJSONConfig } from '../../../stores/float.ts';
import { normalize_geojson } from '@tak-ps/node-cot/normalize_geojson';
import {
    IconFileImport,
} from '@tabler/icons-vue';
import type { LngLatBoundsLike } from 'maplibre-gl';
import FeatureRow from '../util/FeatureRow.vue';
import FloatingPane from '../util/FloatingPane.vue';
import { bbox } from '@turf/bbox';
import type { InputFeature } from '../../../types.ts';

const mapStore = useMapStore();
const floatStore = useFloatStore();

const props = defineProps({
    uid: {
        type: String,
        required: true
    }
});

const emit = defineEmits(['close']);

const pane = floatStore.panes.get(props.uid) as Pane<PaneGeoJSONConfig> | undefined;

const error = ref<Error | undefined>();
const file = ref<File | undefined>();

const feats = ref<InputFeature[]>(pane?.config.features ?? []);

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
                    const creator = norm.properties.creator;
                    const normalizedFeature: InputFeature = {
                        ...norm,
                        path: `/${name}/`,
                        properties: {
                            ...norm.properties,
                            creator: creator ? {
                                ...creator,
                                callsign: creator.callsign ?? ''
                            } : undefined
                        }
                    };

                    // TODO Remove once we support the metadata property throughout
                    feats.value.push(normalizedFeature)
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

    const adding = feats.value.map((feat: InputFeature) =>
        JSON.parse(JSON.stringify(feat))
    );

    await mapStore.worker.db.addAll(adding, {
        authored: true,
        render: false
    });

    if (mapStore.mission) {
        await mapStore.loadMission(mapStore.mission.meta.guid);
    }

    loading.value = false;

    emit('close');
}
</script>
