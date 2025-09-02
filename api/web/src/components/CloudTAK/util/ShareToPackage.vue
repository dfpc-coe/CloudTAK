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
                <span class='mx-2'>Create Data Package</span>
            </div>
        </div>
        <div class='modal-body text-white'>
            <TablerLoading v-if='loading' />
            <div
                v-else
                class='row mx-2'
            >
                <div class='col-12'>
                    <TablerInput
                        v-model='body.name'
                        label='Name'
                    />
                </div>
                <div class='col-12 pt-3'>
                    <label class='mx-2 user-select-none'>Contents:</label>

                    <div
                        v-if='props.feats.length !== 0 || props.assets.length !== 0'
                        class='col-12 overflow-auto'
                        style='
                            max-height: 20vh;
                        '
                    >
                        <div
                            v-for='asset of props.assets'
                            class='d-flex align-items-center px-3 py-2'
                        >
                            <IconFile
                                :size='24'
                                stroke='1'
                            />
                            <span
                                class='mx-2 user-select-none'
                                v-text='asset.name'
                            />
                        </div>
                        <FeatureRow
                            v-for='feat of props.feats'
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

                <!-- TODO SHOW CHANNEL SELECTION -->

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
    TablerInput,
} from '@tak-ps/vue-tabler';
import { std } from '../../../std.ts';
import { useMapStore } from '../../../stores/map.ts';
import {
    IconFile,
    IconPackage,
} from '@tabler/icons-vue';
import { useRouter } from 'vue-router';
import FeatureRow from './FeatureRow.vue';
import type { Feature, Content } from '../../../types.ts';

const mapStore = useMapStore();
const router = useRouter();

const props = defineProps({
    name: {
        type: String,
        default: ''
    },
    assets: {
        type: Array as PropType<Array<{
            type: string;
            id: number | string;
            name: string;
        }>>,
        default: () => []
    },
    feats: {
        type: Array as PropType<Array<Feature>>,
        required: true,
        default: () => []
    },
});

const emit = defineEmits(['close', 'done']);

const loading = ref(false);

const body = ref({
    name: props.name
})

async function share() {
    const feats = [];

    for (const f of props.feats || []) {
        if (f.properties.type === 'b-f-t-r') {
            // FileShare is manually generated and won't exist in CoT Store
            return f;
        } else {
            const feat = await mapStore.worker.db.get(f.properties.id || f.id, {
                mission: true
            });
            console.error(feat);
            if (feat) feats.push(feat.as_feature());
        }
    }

    loading.value = true;

    try {
        const content = await std('/api/marti/package', {
            method: 'PUT',
            body: {
                type: 'FeatureCollection',
                name: body.value.name,
                public: true,
                assets: props.assets,
                features: feats.map((f) => {
                    f = JSON.parse(JSON.stringify(f));
                    return { id: f.properties.id || f.id, type: f.type, properties: f.properties, geometry: f.geometry }
                })
            }
        }) as Content;

        emit('done');

        router.push(`/menu/packages/${content.Hash}`);
    } catch (err) {
        loading.value = false;
        throw err;
    }

}
</script>
