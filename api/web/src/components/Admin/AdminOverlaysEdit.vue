<template>
    <div>
        <div class='card-header'>
            <TablerIconButton
                title='Back'
                @click='$router.push("/admin/overlay")'
            >
                <IconCircleArrowLeft
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <h1 class='card-title'>
                <span v-if='route.params.overlay === "new"' class='mx-2'>New Overlay</span>
                <span v-else class='mx-2'>Edit Overlay</span>
            </h1>

            <div class='ms-auto btn-list'>
                <TablerIconButton
                    v-if='route.params.overlay === "new"'
                    title='Create from Public Tiles'
                    @click='publicTileSelect = true'
                >
                    <IconFileDownload
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>
        <div
            style='min-height: 20vh; margin-bottom: 61px'
            class='px-2'
        >
            <TablerLoading v-if='loading' />
            <div
                v-else
                class='row'
            >
                <div class='col-12'>
                    <TablerInput
                        v-model='overlay.name'
                        label='Name'
                    />
                </div>
                <div class='col-12'>
                    <label class='mx-2 my-1'>Ownership</label>
                    <div class='border rounded'>
                        <UserSelect
                            v-model='overlay.username'
                        />
                    </div>
                </div>
                <div class='col-12'>
                    <TablerInput
                        v-model='overlay.url'
                        label='Data URL'
                    >
                        <TablerToggle
                            v-model='overlay.overlay'
                            label='Overlay'
                        />
                    </TablerInput>
                </div>
                <div class='col-12 col-md-6'>
                    <TablerInput
                        v-model='overlay.minzoom'
                        label='MinZoom'
                    />
                </div>
                <div class='col-12 col-md-6'>
                    <TablerInput
                        v-model='overlay.maxzoom'
                        label='MaxZoom'
                    />
                </div>
                <div class='col-12 col-md-6'>
                    <TablerInput
                        v-model='overlay.bounds'
                        label='Bounds'
                    />
                </div>
                <div class='col-12 col-md-6'>
                    <TablerInput
                        v-model='overlay.center'
                        label='Center'
                    />
                </div>
                <div class='col-12 col-md-6'>
                    <TablerEnum
                        v-model='overlay.type'
                        label='Type'
                        :options='["vector", "raster"]'
                    />
                </div>
                <div class='col-12 col-md-6'>
                    <TablerEnum
                        v-model='overlay.format'
                        label='Overlay Format'
                        :default='formats[0]'
                        :options='formats'
                    />
                </div>
                <div class='col-12'>
                    <StyleContainer
                        v-model='overlay.styles'
                        :advanced='true'
                    />
                </div>
                <div class='col-12 d-flex py-2'>
                    <TablerDelete
                        v-if='overlay.id'
                        @delete='deleteOverlay'
                    />
                    <div class='ms-auto'>
                        <TablerButton
                            class='btn-primary'
                            @click='saveOverlay'
                        >
                            Submit
                        </TablerButton>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { std, stdurl } from '/src/std.ts';
import StyleContainer from '../Styling/Style.vue';
import UserSelect from '../util/UserSelect.vue';
import {
    IconFileDownload,
    IconCircleArrowLeft
} from '@tabler/icons-vue';
import {
    TablerEnum,
    TablerInput,
    TablerLoading,
    TablerToggle,
    TablerButton,
    TablerDelete,
    TablerIconButton
} from '@tak-ps/vue-tabler';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const publicTileSelect = ref(false);
const overlay = ref({
    name: '',
    url: '',
    type: 'vector',
    overlay: true,
    styles: [],
    minzoom: 0,
    maxzoom: 16,
    bounds: '-180, -90, 180, 90',
    center: '0, 0',
});

const formats = computed(() => {
    if (overlay.value.type === 'vector') {
        return [ "mvt" ];
    } else {
        return [ "jpeg", "png" ];
    }
});

onMounted(async () => {
    if (route.params.overlay !== 'new') {
        await fetchOverlay();
    } else {
        loading.value = false;
    }
});

async function deleteOverlay() {
    try {
        loading.value = true;

        await std(`/api/basemap/${overlay.value.id}`, {
            method: 'DELETE'
        });

        router.push('/admin/overlay');
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function saveOverlay() {
    let body = JSON.parse(JSON.stringify(overlay.value));

    body.bounds = body.bounds.split(',').map((b) => {
        return Number(b);
    })

    body.center = body.center.split(',').map((b) => {
        return Number(b);
    })

    if (body.username) {
        body.scope = 'user'
    } else {
        body.scope = 'server'
    }

    loading.value = true;

    try {
        if (route.params.overlay === 'new') {
            const url = stdurl(`/api/basemap`);
            if (body.username) url.searchParams.append('impersonate', body.username);
            const ov = await std(url, { method: 'POST', body });
            ov.bounds = ov.bounds.join(',');
            ov.center = ov.center.join(',');

            overlay.value = ov;

            router.push(`/admin/overlay/${overlay.value.id}`);
        } else {
            const url = stdurl(`/api/basemap/${overlay.value.id}`);
            if (body.username) url.searchParams.append('impersonate', body.username);
            const ov = await std(url, { method: 'PATCH', body });
            ov.bounds = ov.bounds.join(',');
            ov.center = ov.center.join(',');

            overlay.value = ov;
        }

        loading.value = false;
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function fetchOverlay() {
    loading.value = true;
    const url = stdurl(`/api/basemap/${route.params.overlay}`);
    const res = await std(url);

    if (!res.bounds) {
        res.bounds = '-180, -90, 180, 90';
    } else {
        res.bounds = res.bounds.join(',');
    }

    if (!res.center) {
        res.center = '0, 0';
    } else {
        res.center = res.center.join(',');
    }


    overlay.value = res;
    loading.value = false;
}
</script>
