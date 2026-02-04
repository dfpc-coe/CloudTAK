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
                <span
                    v-if='route.params.overlay === "new"'
                    class='mx-2'
                >New Overlay</span>
                <span
                    v-else
                    class='mx-2'
                >Edit Overlay</span>
            </h1>
        </div>
        <div
            style='min-height: 20vh; margin-bottom: 61px'
            class='px-2'
        >
            <TablerLoading v-if='loading' />
            <div
                v-else
                class='row g-2'
            >
                <div class='col-12'>
                    <TablerInput
                        v-model='overlay.name'
                        label='Name'
                        description='The display name of the overlay layer'
                    >
                        <TablerToggle
                            v-model='overlay.sharing_enabled'
                            label='Enable Sharing'
                            description='Allow this overlay to be shared with other users via invalidatable token'
                        />
                        <TablerToggle
                            v-model='overlay.hidden'
                            label='Hidden'
                            description='Hide this overlay from the default list'
                        />
                    </TablerInput>
                </div>
                <div class='col-12'>
                    <label class='mx-2 my-1'>Ownership</label>
                    <div class='border rounded'>
                        <UserSelect
                            v-model='overlay.username'
                        />
                    </div>
                </div>
                <div
                    class='px-2 py-2 round btn-group w-100'
                    role='group'
                >
                    <input
                        id='entry-manual'
                        type='radio'
                        class='btn-check'
                        autocomplete='off'
                        :checked='mode === "manual"'
                        @click='mode = "manual"'
                    >
                    <label
                        for='entry-manual'
                        type='button'
                        class='btn btn-sm'
                    ><IconTerminal
                        v-tooltip='"Manual Entry"'
                        class='me-2'
                        :size='32'
                        stroke='1'
                    />Manual Entry</label>

                    <input
                        id='entry-public'
                        type='radio'
                        class='btn-check'
                        autocomplete='off'
                        :checked='mode === "public"'
                        @click='mode = "public"'
                    >

                    <label
                        for='entry-public'
                        type='button'
                        class='btn btn-sm'
                    ><IconList
                        v-tooltip='"Public Tilesets"'
                        class='me-2'
                        :size='32'
                        stroke='1'
                    />Public Tilesets</label>
                </div>

                <template v-if='mode === "public"'>
                    <PublicTilesSelect
                        :url='overlay.url'
                        @select='publicTileSelect($event)'
                    />
                </template>

                <div class='col-12'>
                    <TablerInput
                        v-model='overlay.url'
                        :disabled='mode !== "manual"'
                        label='Data URL'
                        description='The URL template of the tile server'
                    >
                        <TablerToggle
                            v-model='overlay.overlay'
                            label='Overlay'
                            description='If true, this layer is treated as an overlay on top of base maps'
                        />
                    </TablerInput>
                </div>

                <div class='col-12 col-md-3'>
                    <TablerInput
                        v-model='overlay.minzoom'
                        :disabled='mode !== "manual"'
                        type='number'
                        label='Minzoom'
                        description='The minimum zoom level for which tiles are available'
                    />
                </div>
                <div class='col-12 col-md-3'>
                    <TablerInput
                        v-model='overlay.maxzoom'
                        :disabled='mode !== "manual"'
                        type='number'
                        label='Maxzoom'
                        description='The maximum zoom level for which tiles are available'
                    />
                </div>
                <div class='col-12 col-md-6'>
                    <TablerInput
                        v-model='overlay.frequency'
                        label='Update Frequency (Seconds)'
                        description='How often to refresh the tiles in seconds'
                    />
                </div>
                <div class='col-12 col-md-6'>
                    <TablerInput
                        v-model='overlay.bounds'
                        :disabled='mode !== "manual"'
                        label='Bounds'
                        description='The geographic bounds of the overlay (W,S,E,N)'
                    />
                </div>
                <div class='col-12 col-md-6'>
                    <TablerInput
                        v-model='overlay.center'
                        :disabled='mode !== "manual"'
                        label='Center'
                        description='The default center point of the overlay (Lon,Lat)'
                    />
                </div>
                <div class='col-12 col-md-6'>
                    <TablerEnum
                        v-model='overlay.type'
                        label='Type'
                        :options='["vector", "raster", "raster-dem"]'
                        description='The type of data served by this overlay'
                    />
                </div>
                <div class='col-12 col-md-6'>
                    <TablerEnum
                        v-model='overlay.format'
                        label='Overlay Format'
                        :default='formats[0]'
                        :options='formats'
                        description='The file format of existing tiles'
                    />
                </div>

                <template v-if='overlay.type === "vector" && mode === "public"'>
                    <div class='col-12'>
                        <div class='row g-2 my-2 border rounded'>
                            <div class='col-12'>
                                <TablerToggle
                                    v-model='overlay.snapping_enabled'
                                    label='Enable Snapping'
                                    description='Allow drawing tools to snap to the underlying vector features'
                                />
                            </div>

                            <div
                                v-if='overlay.snapping_enabled'
                                class='col-12'
                            >
                                <TablerInput
                                    v-model='overlay.snapping_layer'
                                    label='Snapping Layer'
                                    description='The specific layer name within the vector tiles to snap to'
                                />
                            </div>
                        </div>
                    </div>
                </template>

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
import { std, stdurl } from '../../std.ts';
import StyleContainer from '../ETL/Styling/Style.vue';
import UserSelect from '../util/UserSelect.vue';
import PublicTilesSelect from '../util/PublicTilesSelect.vue';
import {
    IconTerminal,
    IconList,
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
const mode = ref('manual');
const overlay = ref({
    name: '',
    url: '',
    type: 'vector',
    overlay: true,
    styles: [],
    minzoom: 0,
    maxzoom: 16,
    frequency: 0,
    sharing_enabled: true,
    sharing_token: null,
    hidden: false,
    bounds: '-180, -90, 180, 90',
    center: '0, 0',
    snapping_enabled: false,
    snapping_layer: ''
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

function publicTileSelect(tilejson) {
    if (tilejson) {
        if (!overlay.value.name) {
            overlay.value.name = tilejson.name.replace(/^public\//, "").replace(/\.pmtiles$/, "");
        }

        overlay.value.url = tilejson.tiles[0].replace(/\?.*$/, '');
        overlay.value.minzoom = tilejson.minzoom;
        overlay.value.maxzoom = tilejson.maxzoom;
        overlay.value.bounds = tilejson.bounds.join(',');
        overlay.value.center = tilejson.center.slice(0, 2).join(',');
    } else {
        overlay.value.url = '';
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

    if (body.frequency) {
        body.frequency = Number(body.frequency);
    } else {
        body.frequency = null;
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

    // If the URL is hosted on the S3 CloudTAK site assume it is a public tile
    try {
        const u = new URL(res.url);
        if (u.hostname === 'tiles.map.cotak.gov') {
            mode.value = 'public';
        }
    } catch {
        // pass
    }

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

    if (res.snapping_enabled === undefined) res.snapping_enabled = false;
    if (!res.snapping_layer) res.snapping_layer = '';
    if (res.hidden === undefined) res.hidden = false;

    overlay.value = res;
    loading.value = false;
}
</script>
