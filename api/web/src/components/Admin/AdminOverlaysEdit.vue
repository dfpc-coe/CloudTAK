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
                        v-model='basemaps[mode].name'
                        label='Name'
                        description='The display name of the overlay layer'
                    >
                        <TablerToggle
                            v-model='basemaps[mode].sharing_enabled'
                            label='Enable Sharing'
                            description='Allow this overlay to be shared with other users via invalidatable token'
                        />
                        <TablerToggle
                            v-model='basemaps[mode].hidden'
                            label='Hidden'
                            description='Hide this overlay from the default list'
                        />
                        <TablerToggle
                            v-model='basemaps[mode].overlay'
                            label='Overlay'
                            description='If true, this layer is treated as an overlay on top of base maps'
                        />
                    </TablerInput>
                </div>
                <div class='col-12'>
                    <label class='mx-2 my-1'>Ownership</label>
                    <div class='border rounded'>
                        <UserSelect
                            v-model='basemaps[mode].username'
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

                    <input
                        id='entry-tilejson'
                        type='radio'
                        class='btn-check'
                        autocomplete='off'
                        :checked='mode === "tilejson"'
                        @click='mode = "tilejson"'
                    >

                    <label
                        for='entry-tilejson'
                        type='button'
                        class='btn btn-sm'
                    ><IconBraces
                        v-tooltip='"TileJSON"'
                        class='me-2'
                        :size='32'
                        stroke='1'
                    />TileJSON</label>
                </div>

                <template v-if='mode === "public"'>
                    <PublicTilesSelect
                        :url='basemaps[mode].url'
                        @select='publicTileSelect($event)'
                    />
                </template>
                <template v-else-if='mode === "tilejson"'>
                    <div class='col-12'>
                        <label class='form-label'>TileJSON URL</label>
                        <div class='input-group'>
                            <input
                                v-model='tilejson_url'
                                type='text'
                                class='form-control'
                                placeholder='https://example.com/tilejson.json'
                            >
                            <TablerButton
                                class='btn-primary'
                                @click='fetchTileJSON'
                            >
                                <IconSearch
                                    :size='20'
                                    stroke='1'
                                />
                            </TablerButton>
                        </div>
                    </div>
                </template>

                <template v-if='mode === "manual"'>
                    <div class='col-12'>
                        <TablerInput
                            v-model='basemaps[mode].url'
                            label='Data URL'
                            description='The URL template of the tile server'
                        />
                    </div>

                    <div class='col-12 col-md-3'>
                        <TablerInput
                            v-model='basemaps[mode].minzoom'
                            type='number'
                            label='Minzoom'
                            description='The minimum zoom level for which tiles are available'
                        />
                    </div>
                    <div class='col-12 col-md-3'>
                        <TablerInput
                            v-model='basemaps[mode].maxzoom'
                            type='number'
                            label='Maxzoom'
                            description='The maximum zoom level for which tiles are available'
                        />
                    </div>

                    <div class='col-12 col-md-3'>
                        <TablerInput
                            v-model='basemaps[mode].bounds'
                            label='Bounds'
                            description='(W,S,E,N)'
                        />
                    </div>
                    <div class='col-12 col-md-3'>
                        <TablerInput
                            v-model='basemaps[mode].center'
                            label='Center'
                            description='(Lon,Lat)'
                        />
                    </div>
                    <div class='col-12 col-md-6'>
                        <TablerEnum
                            v-model='basemaps[mode].type'
                            label='Type'
                            :options='["vector", "raster", "raster-dem"]'
                            description='The type of data served by this overlay'
                        />
                    </div>
                    <div class='col-12 col-md-6'>
                        <TablerEnum
                            v-model='basemaps[mode].format'
                            label='Overlay Format'
                            :default='formats[0]'
                            :options='formats'
                            description='The file format of existing tiles'
                        />
                    </div>
                </template>
                <template v-else-if="basemaps[mode].url">
                    <TileJSONView :overlay="basemaps[mode]" />
                </template>

                <template v-if="mode === 'manual' || basemaps[mode].url">
                    <div class="col-12">
                        <TablerInput
                            v-if="basemaps[mode].frequency !== undefined && basemaps[mode].frequency !== null"
                            v-model='basemaps[mode].frequency'
                            label='Update Frequency (Seconds)'
                            description='How often to refresh the tiles in seconds'
                        >
                            <TablerToggle
                                :model-value="true"
                                label="Enabled"
                                @click="basemaps[mode].frequency = null"
                            />
                        </TablerInput>
                        <div v-else
                            class="mx-2 my-2"
                        >
                            <TablerToggle
                                :model-value="false"
                                label="Enable Auto-Update Frequency"
                                description="Automatically refresh the tiles periodically"
                                @click="basemaps[mode].frequency = 60"
                            />
                        </div>
                    </div>

                    <template v-if='basemaps[mode].type === "vector" && (mode === "public" || mode === "tilejson")'>
                        <div class='col-12'>
                            <div class='row g-2 my-2 border rounded'>
                                <div class='col-12'>
                                    <TablerToggle
                                        v-model='basemaps[mode].snapping_enabled'
                                        label='Enable Snapping'
                                        description='Allow drawing tools to snap to the underlying vector features'
                                    />
                                </div>

                                <div
                                    v-if='basemaps[mode].snapping_enabled'
                                    class='col-12'
                                >
                                    <TablerInput
                                        v-model='basemaps[mode].snapping_layer'
                                        label='Snapping Layer'
                                        description='The specific layer name within the vector tiles to snap to'
                                    />
                                </div>
                            </div>
                        </div>
                    </template>

                    <div class='col-12'>
                        <StyleContainer
                            v-model='basemaps[mode].styles'
                            :advanced='true'
                        />
                    </div>
                    <div class='col-12 d-flex py-2'>
                        <TablerDelete
                            v-if='basemaps[mode].id'
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
                </template>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { std, stdurl } from '../../std.ts';
import StyleContainer from '../ETL/Styling/Style.vue';
import UserSelect from '../util/UserSelect.vue';
import PublicTilesSelect from '../util/PublicTilesSelect.vue';
import TileJSONView from './TileJSONView.vue';
import {
    IconTerminal,
    IconList,
    IconCircleArrowLeft,
    IconBraces,
    IconSearch
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
const tilejson_url = ref('');

const basemaps = ref({
    manual: {
        name: '',
        url: '',
        minzoom: 0,
        maxzoom: 16,
        bounds: '-180, -90, 180, 90',
        center: '0, 0',
        type: 'vector',
        format: 'mvt',
        overlay: true,
        styles: [],
        frequency: null,
        sharing_enabled: true,
        sharing_token: null,
        hidden: false,
        snapping_enabled: false,
        snapping_layer: ''
    },
    public: {
        name: '',
        url: '',
        minzoom: 0,
        maxzoom: 16,
        bounds: '-180, -90, 180, 90',
        center: '0, 0',
        type: 'vector',
        format: 'mvt',
        overlay: true,
        styles: [],
        frequency: null,
        sharing_enabled: true,
        sharing_token: null,
        hidden: false,
        snapping_enabled: false,
        snapping_layer: ''
    },
    tilejson: {
        name: '',
        url: '',
        minzoom: 0,
        maxzoom: 16,
        bounds: '-180, -90, 180, 90',
        center: '0, 0',
        type: 'vector',
        format: 'mvt',
        overlay: true,
        styles: [],
        frequency: null,
        sharing_enabled: true,
        sharing_token: null,
        hidden: false,
        snapping_enabled: false,
        snapping_layer: ''
    }
});

const formats = computed(() => {
    if (basemaps.value[mode.value].type === 'vector') {
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

        await std(`/api/basemap/${basemaps.value[mode.value].id}`, {
            method: 'DELETE'
        });

        router.push('/admin/overlay');
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function fetchTileJSON() {
    if (!tilejson_url.value) return;

    const res = await std('/api/basemap', {
        method: 'PUT',
        headers: {
            'Content-Type': 'text/plain'
        },
        body: tilejson_url.value
    });

    if (res.name && !basemaps.value[mode.value].name) basemaps.value[mode.value].name = res.name;

    basemaps.value[mode.value].url = tilejson_url.value.replace(/^https?:\/\//, 'tilejson://');

    if (res.minzoom !== undefined) basemaps.value[mode.value].minzoom = res.minzoom;
    if (res.maxzoom !== undefined) basemaps.value[mode.value].maxzoom = res.maxzoom;
    if (res.type) basemaps.value[mode.value].type = res.type;
    if (res.format) basemaps.value[mode.value].format = res.format;

    if (res.bounds && Array.isArray(res.bounds)) {
        basemaps.value[mode.value].bounds = res.bounds.join(',');
    } else if (res.bounds) {
        basemaps.value[mode.value].bounds = res.bounds;
    }

    if (res.center && Array.isArray(res.center)) {
        basemaps.value[mode.value].center = res.center.slice(0, 2).join(',');
    } else if (res.center) {
        basemaps.value[mode.value].center = res.center;
    }
}

function publicTileSelect(tilejson) {
    if (tilejson) {
        if (!basemaps.value[mode.value].name) {
            basemaps.value[mode.value].name = tilejson.name.replace(/^public\//, "").replace(/\.pmtiles$/, "");
        }

        const url = new URL(tilejson.url);
        url.search = '';
        basemaps.value[mode.value].url = url.toString().replace(/^https?:\/\//, 'tilejson://');
        if (tilejson.minzoom !== undefined) basemaps.value[mode.value].minzoom = tilejson.minzoom;
        if (tilejson.maxzoom !== undefined) basemaps.value[mode.value].maxzoom = tilejson.maxzoom;
        if (tilejson.bounds) basemaps.value[mode.value].bounds = tilejson.bounds.join(',');
        if (tilejson.center) basemaps.value[mode.value].center = tilejson.center.slice(0, 2).join(',');
    } else {
        basemaps.value[mode.value].url = '';
    }
}

async function saveOverlay() {
    let body = JSON.parse(JSON.stringify(basemaps.value[mode.value]));

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
            if (body.username) url.searchParams.set('impersonate', body.username);
            const ov = await std(url, { method: 'POST', body });
            ov.bounds = ov.bounds.join(',');
            ov.center = ov.center.join(',');

            basemaps.value[mode.value] = ov;

            router.push(`/admin/overlay/${basemaps.value[mode.value].id}`);
        } else {
            const url = stdurl(`/api/basemap/${basemaps.value[mode.value].id}`);
            if (body.username) url.searchParams.set('impersonate', body.username);
            const ov = await std(url, { method: 'PATCH', body });
            ov.bounds = ov.bounds.join(',');
            ov.center = ov.center.join(',');

            basemaps.value[mode.value] = ov;
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

    basemaps.value[mode.value] = res;
    loading.value = false;
}
</script>
