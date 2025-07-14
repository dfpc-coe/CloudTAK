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
                <IconPackage
                    :size='28'
                    stroke='1'
                />
                <span class='mx-2'>Import GeoJSON</span>
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
                        accept=".json, .geojson"
                        @change='processUpload($event)'
                        label='File'
                    />
                </div>

                <div class='col-12 pt-3'>
                    <GenericAlert
                        v-if='error'
                        :description='error.message'
                    />
                </div>

                <div class='col-12 pt-3'>
                    <GenericAlert
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
                v-if='feats.length'
                class='row mx-2'
            >
                <div v-if='feats.length' class='col-12 pt-3'>
                    <label class='mx-2 user-select-none'>Contents:</label>

                    <div
                        v-if='feats.length !== 0'
                        class='col-12 overflow-auto'
                        style='
                            max-height: 20vh;
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
                        label='Contents'
                    />
                </div>

                <div class='col-12 pt-3'>
                    <TablerButton
                        class='w-100'
                        @click='share'
                    >
                        Create
                    </TablerButton>
                </div>
            </div>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import type { PropType } from 'vue';
import {
    TablerNone,
    TablerModal,
    TablerLoading,
    TablerButton,
    TablerFileInput,
} from '@tak-ps/vue-tabler';
import { std } from '../../std.ts';
import { useMapStore } from '../../stores/map.ts';
import GenericAlert from '../util/GenericAlert.vue';
import { from_geojson, to_geojson } from '@tak-ps/node-cot/from_geojson';
import {
    IconFile,
    IconPackage,
} from '@tabler/icons-vue';
import { useRouter } from 'vue-router';
import FeatureRow from './util/FeatureRow.vue';
import type { Feature } from '../../types.ts';

const mapStore = useMapStore();
const router = useRouter();

const error = ref<Error | undefined>();
const file = ref<File | undefined>();
const feats = ref<Feature[]>([]);

const emit = defineEmits(['close', 'done']);

const loading = ref(false);

async function processUpload(event: Event) {
    if (!event.target || !(event.target instanceof HTMLInputElement)) return;
    if (event.target.files?.length === 0) return;

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
            const fc = JSON.parse(e.target.result);

            if (!fc || !fc.features || !Array.isArray(fc.features)) {
                throw new Error('Invalid GeoJSON format');
            }


            loading.value = false;
        } catch (err) {
            loading.value = false;
            error.value = err instanceof Error ? err : new Error(String(err));
        }
    };

}
</script>
