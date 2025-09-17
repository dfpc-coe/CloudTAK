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
                        v-if='props.upload'
                        class='mb-2'
                    >
                        <Upload
                            ref='upload'
                            :cancel='false'
                            :url='uploadUrl'
                            :headers='uploadHeaders()'
                            :autoupload='false'
                            @staged='stageUpload($event)'
                        />
                    </div>
                    <div
                        v-else-if='props.feats.length !== 0 || props.assets.length !== 0'
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

                <GroupSelect
                    v-model='body.groups'
                    :active='true'
                    direction='IN'
                />

                <TagEntry
                    placeholder='Hashtags'
                    @tags='body.keywords = $event'
                />

                <div class='col-12 pt-3'>
                    <TablerButton
                        class='w-100 btn-primary'
                        :disabled='!body.groups.length && (!props.upload || uploaded)'
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
import { ref, computed, useTemplateRef } from 'vue';
import type { PropType } from 'vue';
import TagEntry from './TagEntry.vue';
import Upload from '../../util/Upload.vue';
import {
    TablerNone,
    TablerModal,
    TablerLoading,
    TablerButton,
    TablerInput,
} from '@tak-ps/vue-tabler';
import { server, stdurl } from '../../../std.ts';
import { useMapStore } from '../../../stores/map.ts';
import {
    IconFile,
    IconPackage,
} from '@tabler/icons-vue';
import { useRouter } from 'vue-router';
import FeatureRow from './FeatureRow.vue';
import type { Feature, Content } from '../../../types.ts';
import GroupSelect from './GroupSelect.vue';

const mapStore = useMapStore();
const router = useRouter();

const props = defineProps({
    name: {
        type: String,
        default: ''
    },
    upload: {
        type: Boolean,
        default: false
    },
    assets: {
        type: Array as PropType<Array<{
            type: 'profile';
            id: number | string;
            name: string;
        }>>,
        default: () => []
    },
    feats: {
        type: Array as PropType<Array<Feature>>,
        default: () => []
    },
});

const emit = defineEmits(['close', 'done']);

const loading = ref(false);

const uploaded = ref<boolean>(false);

const uploadRef = useTemplateRef<typeof Upload>('upload');

const body = ref({
    name: props.name,
    keywords: [],
    groups: []
})

const uploadUrl = computed(() => {
    const url = stdurl('/api/marti/package');
    url.searchParams.set('name', body.value.name);
    for (const g of body.value.groups) {
        url.searchParams.append('groups', g);
    }

    for (const k of body.value.keywords) {
        url.searchParams.append('keywords', k);
    }

    return url;
});

function stageUpload(file: { name: string }) {
    body.value.name = body.value.name || file.name;
    uploaded.value = true;
}

function uploadHeaders() {
    return {
        Authorization: `Bearer ${localStorage.token}`
    };
}

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

    if (props.upload && uploadRef.value) {
        const res = await uploadRef.value.upload() as Content;

        router.push(`/menu/packages/${res.Hash}`);

        emit('done');
    } else {
        try {
            const res = await server.PUT('/api/marti/package', {
                body: {
                    type: 'FeatureCollection',
                    name: body.value.name,
                    public: true,
                    groups: body.value.groups,
                    keywords: body.value.keywords,
                    assets: props.assets.map((a) => ({ type: a.type, id: String(a.id) })),
                    basemaps: [],
                    destinations: [],
                    features: feats.map((f) => {
                        f = JSON.parse(JSON.stringify(f));
                        return { id: f.properties.id || f.id, type: f.type, properties: f.properties, geometry: f.geometry }
                    })
                }
            });

            if (res.error) throw new Error(res.error.message);

            emit('done');

            router.push(`/menu/packages/${res.data.Hash}`);
        } catch (err) {
            loading.value = false;
            throw err;
        }
    }
}
</script>
