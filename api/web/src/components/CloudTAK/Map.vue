<template>
    <div
        data-bs-theme='dark'
        class='d-flex position-relative'
        style='height: calc(100vh) !important;'
    >
        <div
            ref='map'
            style='width: 100%;'
        />

        <Loading v-if='loading || !mapStore.isLoaded' />

        <template v-if='mapStore.isLoaded && !loading'>
            <WarnConfiguration
                v-if='warnConfiguration'
                @close='warnConfiguration = false'
            />
            <WarnChannels
                v-else-if='warnChannels'
                @close='warnChannels = false'
            />

            <div
                v-if='profileStore.profile'
                class='position-absolute bottom-0 begin-0 text-white'
                style='
                    z-index: 1;
                    width: 250px;
                    height: 40px;
                    border-radius: 0px 6px 0px 0px;
                    background-color: rgba(0, 0, 0, 0.5);
                '
            >
                <div
                    class='d-flex align-items-center'
                    style='height: 40px'
                >
                    <Status
                        v-if='live_loc'
                        v-tooltip='"Using Live Location"'
                        class='mx-2 my-2'
                        status='success'
                        :dark='true'
                    />
                    <div
                        v-else
                        v-tooltip='"Set Location"'
                        class='hover-button h-100 px-2 d-flex align-items-center cursor-pointer'
                        style='width: 40px;'
                    >
                        <IconLocationOff
                            v-if='!profileStore.profile.tak_loc'
                            title='Set Your Location Button (No Location currently set)'
                            :size='20'
                            stroke='1'
                            @click='setLocation'
                        />
                        <IconLocation
                            v-else
                            title='Set Your Location Button'
                            :size='20'
                            stroke='1'
                            @click='setLocation'
                        />
                    </div>
                    <div
                        v-tooltip='"Zoom To Location"'
                        style='line-height: 40px; width: calc(100% - 40px);'
                        class='h-100 cursor-pointer text-center px-2 text-truncate subheader text-white hover-button'
                        @click='toLocation'
                        v-text='profileStore.profile.tak_callsign'
                    />
                </div>
            </div>
            <div
                v-if='mapStore.selected.size'
                class='position-absolute begin-0 text-white bg-dark'
                style='
                    bottom: 40px;
                    width: 250px;
                '
            >
                <SelectFeats :selected='mapStore.selected' />
            </div>

            <div
                v-if='mode === "Default"'
                class='position-absolute top-0 beginning-0 text-white'
            >
                <div
                    style='
                        z-index: 1;
                        width: 60px;
                        background-color: rgba(0, 0, 0, 0.5);
                        border-radius: 0px 0px 6px 0px;
                    '
                >
                    <IconSearch
                        v-tooltip='"Search"'
                        tabindex='0'
                        title='Search Button'
                        :size='40'
                        stroke='1'
                        style='margin: 5px 8px'
                        class='cursor-pointer hover-button'
                        @click='search.shown = !search.shown'
                    />

                    <div
                        style='margin: 5px 8px'
                        class='cursor-pointer hover-button'
                        @click='mapStore.map.setBearing(0)'
                    >
                        <IconCircleArrowUp
                            v-tooltip='"Snap to North"'
                            tabindex='0'
                            :alt='`Map Rotated to ${humanBearing}`'
                            :transform='`rotate(${360 - mapStore.bearing})`'
                            :size='40'
                            stroke='1'
                        />
                        <div
                            v-if='mapStore.bearing !== 0'
                            class='text-center'
                            v-text='humanBearing'
                        />
                    </div>
                    <IconFocus2
                        v-if='!mapStore.radial.cot && !locked.length'
                        v-tooltip='"Get Location"'
                        role='button'
                        tabindex='0'
                        title='Get Your Location button'
                        :size='40'
                        stroke='1'
                        class='cursor-pointer hover-button'
                        style='margin: 5px 8px'
                        @click='getLocation'
                    />
                    <IconLockAccess
                        v-else-if='!mapStore.radial.cot'
                        role='button'
                        tabindex='0'
                        title='Map is locked to marker'
                        :size='40'
                        stroke='1'
                        class='cursor-pointer hover-button'
                        style='margin: 5px 8px'
                        @click='locked.splice(0, locked.length)'
                    />

                    <div
                        v-if='!mobileDetected'
                    >
                        <IconPlus
                            v-tooltip='"Zoom In"'
                            role='button'
                            tabindex='0'
                            title='Zoom In Button'
                            :size='40'
                            stroke='1'
                            class='cursor-pointer hover-button'
                            style='margin: 5px 8px'
                            @click='mapStore.map.setZoom(mapStore.map.getZoom() + 1);'
                        />
                        <IconMinus
                            v-tooltip='"Zoom Out"'
                            role='button'
                            tabindex='0'
                            title='Zoom Out Button'
                            :size='40'
                            stroke='1'
                            class='cursor-pointer hover-button'
                            style='margin: 5px 8px'
                            @click='mapStore.map.setZoom(mapStore.map.getZoom() - 1);'
                        />
                    </div>

                    <Icon3dCubeSphere
                        v-tooltip='mapStore.isTerrainEnabled ? "Disable 3D Terrain" : "Enable 3D Terrain"'
                        role='button'
                        tabindex='0'
                        title='3D Terrain'
                        :size='40'
                        stroke='1'
                        class='cursor-pointer hover-button'
                        :color='mapStore.isTerrainEnabled ? "#1E90FF" : "#FFFFFF"'
                        style='margin: 5px 8px'
                        @click='mapStore.isTerrainEnabled ? mapStore.removeTerrain() : mapStore.addTerrain()'
                    />
                </div>
            </div>

            <CoordInput
                v-if='pointInput'
                @close='pointInput = false'
            />

            <div
                v-if='search.shown'
                class='position-absolute text-white bg-dark rounded'
                style='
                    z-index: 1;
                    top: 8px;
                    left: 70px;
                    width: 200px;
                '
            >
                <TablerInput
                    v-model='search.filter'
                    class='mt-0'
                    placeholder='Place Search'
                    icon='search'
                />

                <div
                    v-for='item of search.results'
                    :key='item.magicKey'
                    class='col-12 px-2 py-2 hover-button cursor-pointer'
                    @click='fetchSearch(item.text, item.magicKey)'
                    v-text='item.text'
                />
            </div>

            <div
                v-if='drawMode === "point"'
                class='position-absolute top-0 text-white bg-dark px-2 py-2'
                style='
                    z-index: 1;
                    left: calc(50% - 120px);
                    width: 380px;
                '
            >
                <CoordinateType
                    v-model='drawModePoint'
                />
            </div>

            <div
                v-if='mapStore.isLoaded && mode === "Default"'
                class='d-flex position-absolute top-0 text-white py-2'
                style='
                    z-index: 2;
                    width: 120px;
                    right: 60px;
                    background-color: rgba(0, 0, 0, 0.5);
                    border-radius: 0px 0px 0px 6px;
                '
            >
                <TablerDropdown>
                    <template #default>
                        <div class='mx-2 cursor-pointer'>
                            <IconBell
                                role='button'
                                tabindex='0'
                                :size='40'
                                stroke='1'
                                title='Notifications Icon'
                                class='hover-button'
                            />
                            <span
                                v-if='profileStore.notifications.length'
                                class='badge bg-red mb-2'
                            />
                            <span
                                v-else
                                style='width: 10px;'
                            />
                        </div>
                    </template>
                    <template #dropdown>
                        <TablerNone
                            v-if='!profileStore.notifications.length'
                            label='New Notifications'
                            :create='false'
                        />
                        <template v-else>
                            <div class='col-12 d-flex py-2 px-2'>
                                <div
                                    class='ms-auto cursor-pointer'
                                    @click='profileStore.clearNotifications'
                                >
                                    Clear All
                                </div>
                            </div>
                            <div
                                v-for='n of profileStore.notifications'
                                class='col-12 px-2 py-2'
                            >
                                <div
                                    v-if='n.type === "Chat"'
                                    class='col-12 cursor-pointer hover-dark'
                                    @click='router.push(n.url)'
                                >
                                    <IconMessage
                                        title='Chat Message Icon'
                                        :size='32'
                                        stroke='1'
                                    />
                                    <span v-text='n.name' />
                                </div>
                            </div>
                        </template>
                    </template>
                </TablerDropdown>
                <TablerDropdown>
                    <template #default>
                        <IconPencil
                            role='button'
                            tabindex='0'
                            :size='40'
                            stroke='1'
                            class='mx-2 cursor-pointer hover-button'
                            @click='closeAllMenu'
                        />
                    </template>
                    <template #dropdown>
                        <div
                            class='col-12 py-1 px-2 hover-button cursor-pointer'
                            @click='pointInput = true'
                        >
                            <IconCursorText
                                :size='25'
                                stroke='1'
                            /> Coordinate Input
                        </div>
                        <div
                            class='col-12 py-1 px-2 hover-button cursor-pointer'
                            @click='startDraw("point")'
                        >
                            <IconPoint
                                :size='25'
                                stroke='1'
                            /> Draw Point
                        </div>
                        <div
                            class='col-12 py-1 px-2 hover-button cursor-pointer'
                            @click='startDraw("linestring")'
                        >
                            <IconLine
                                :size='25'
                                stroke='1'
                            /> Draw Line
                        </div>
                        <div
                            class='col-12 py-1 px-2 hover-button cursor-pointer'
                            @click='startDraw("polygon")'
                        >
                            <IconPolygon
                                :size='25'
                                stroke='1'
                            /> Draw Polygon
                        </div>
                        <div
                            class='col-12 py-1 px-2 hover-button cursor-pointer'
                            @click='startDraw("angled-rectangle")'
                        >
                            <IconVector
                                :size='25'
                                stroke='1'
                            /> Draw Rectangle
                        </div>
                        <div
                            class='col-12 py-1 px-2 hover-button cursor-pointer'
                            @click='startDraw("sector")'
                        >
                            <IconCone
                                :size='25'
                                stroke='1'
                            /> Draw Sector
                        </div>
                        <div
                            class='col-12 py-1 px-2 hover-button cursor-pointer'
                            @click='startDraw("freehand")'
                        >
                            <IconLasso
                                :size='25'
                                stroke='1'
                            /> Lasso Select
                        </div>
                    </template>
                </TablerDropdown>
            </div>

            <div
                v-if='mode === "Default"'
                class='position-absolute top-0 end-0 text-white py-2'
                style='z-index: 1; width: 60px; background-color: rgba(0, 0, 0, 0.5);'
            >
                <IconMenu2
                    v-if='noMenuShown'
                    tabindex='0'
                    role='button'
                    title='Open Menu Button'
                    :size='40'
                    stroke='1'
                    class='mx-2 cursor-pointer hover-button'
                    @click='router.push("/menu")'
                />
                <IconX
                    v-else
                    tabindex='0'
                    title='Close Menu Button'
                    :size='40'
                    stroke='1'
                    class='mx-2 cursor-pointer bg-dark rounded'
                    @click='closeAllMenu'
                />
            </div>


            <SideMenu
                v-if='
                    mapStore.isLoaded
                        && !pointInput
                        && (
                            (noMenuShown && !mobileDetected)
                            || (!noMenuShown)
                        )
                '
                :compact='noMenuShown'
            />

            <MultipleSelect
                v-if='mapStore.select.feats.length'
                @selected='selectFeat($event)'
            />

            <RadialMenu
                v-else-if='mapStore.radial.mode'
                ref='radial'
                @close='closeRadial'
                @click='handleRadial($event)'
            />

            <CloudTAKFeatView
                v-if='feat && mode === "Default"'
                :key='feat.id'
                :feat='feat'
            />

            <template
                v-for='video in videoStore.videos.values()'
                :key='video.uid'
            >
                <CoTVideo
                    :uid='video.uid'
                    @close='videoStore.videos.delete(video.uid)'
                />
            </template>

            <template v-if='upload.shown'>
                <TablerModal>
                    <div class='modal-status bg-red' />
                    <button
                        type='button'
                        class='btn-close'
                        aria-label='Close'
                        @click='upload.shown = false'
                    />
                    <div class='modal-body text-white'>
                        <UploadImport
                            :dragging='upload.dragging'
                            :cancel-button='false'
                            @close='upload.shown = false'
                            @done='fileUpload($event)'
                        />
                    </div>
                </TablerModal>
            </template>
        </template>
    </div>
</template>

<script setup lang='ts'>
import {ref, watch, computed, onMounted, onBeforeUnmount, useTemplateRef } from 'vue';
import {useRoute, useRouter } from 'vue-router';
import CoTVideo from './util/Video.vue';
import WarnChannels from './util/WarnChannels.vue';
import WarnConfiguration from './util/WarnConfiguration.vue';
import Status from '../util/Status.vue';
import CoordInput from './CoordInput.vue';
import CoordinateType from './util/CoordinateType.vue';
import COT from '../../../src/stores/base/cot.ts';
import type { MapGeoJSONFeature } from 'maplibre-gl';
import { std, stdurl } from '../../../src/std.ts';
import type { IconsetList, SearchForward, SearchSuggest, Feature } from '../../../src/types.ts';
import CloudTAKFeatView from './FeatView.vue';
import {
    IconSearch,
    IconMessage,
    IconLocationOff,
    IconLocation,
    IconMenu2,
    IconPlus,
    IconMinus,
    IconFocus2,
    IconLockAccess,
    IconPencil,
    IconLasso,
    IconX,
    IconPoint,
    IconLine,
    IconCone,
    IconPolygon,
    IconCursorText,
    IconVector,
    IconBell,
    IconCircleArrowUp,
    Icon3dCubeSphere,
} from '@tabler/icons-vue';
import SelectFeats from './util/SelectFeats.vue';
import MultipleSelect from './util/MultipleSelect.vue';
import SideMenu from './Menu.vue';
import {
    TablerDropdown,
    TablerModal,
    TablerInput,
    TablerNone,
} from '@tak-ps/vue-tabler';
import Loading from './Loading.vue';
import 'maplibre-gl/dist/maplibre-gl.css';
import RadialMenu from './RadialMenu/RadialMenu.vue';
import { useMapStore } from '../../../src/stores/map.ts';
import { useVideoStore } from '../../../src/stores/videos.ts';
import { useProfileStore } from '../../../src/stores/profile.ts';
import { useCOTStore } from '../../../src/stores/cots.ts';
import { useConnectionStore } from '../../../src/stores/connection.ts';
import UploadImport from './util/UploadImport.vue'
const profileStore = useProfileStore();
const cotStore = useCOTStore();
const mapStore = useMapStore();
const connectionStore = useConnectionStore();
const videoStore = useVideoStore();
const router = useRouter();
const route = useRoute();

const emit = defineEmits(['err']);

const mode = ref<string>('Default');
const height = ref<number>(window.innerHeight);
const width = ref<number>(window.innerWidth);

// Show a popup if no channels are selected on load
const warnChannels = ref<boolean>(false)

// Show a popup if role/groups hasn't been set
const warnConfiguration = ref<boolean>(false);

const search = ref<{
    shown: Boolean,
    filter: string,
    results: Array<{
        text: string
        magicKey: string
    }>
}({
    shown: false,
    filter: '',
    results: []
});
const drawMode = ref<string>('static') // Set the terra-draw mode to avoid getMode() calls
const drawModePoint = ref<string>('u-d-p');
const pointInput = ref<boolean>(false);
const feat = ref()        // Show the Feat Viewer sidebar
const locked = ref([])         // Lock the map view to a given CoT - The last element is the currently locked value
                    //   this is an array so that things like the radial menu can temporarily lock state but remember the previous lock value when they are closed
const live_loc_denied = ref(false)   // User denied live location services
const live_loc = ref<Feature | undefined>();
const upload = ref({
    shown: false,
    dragging: false
})

// Interval for pushing GeoJSON Map Updates (CoT)
const timer = ref<ReturnType<typeof setInterval> | undefined>()
// Interval for pushing your location to the server
const timerSelf = ref<ReturnType<typeof setInterval> | undefined>()

const loading = ref(true)

const mobileDetected = computed(() => {
  //TODO: This needs to follow something like:
  // https://stackoverflow.com/questions/47219272/how-can-i-monitor-changing-window-sizes-in-vue
  return (
    ( width.value <= 800 )
    || ( height.value <= 800 )
  );
});

const humanBearing = computed(() => {
    if (mapStore.bearing < 0) {
        return Math.round(mapStore.bearing * -1) + '°'
    } else {
        return Math.round(360 - mapStore.bearing) + '°';
    }
})

const mapRef = useTemplateRef('map');

const noMenuShown = computed(() => {
    return !feat.value && !pointInput.value && (route.name && !String(route.name).startsWith('home-menu'))
});

watch(mapStore.radial.cot, () => {
    if (mapStore.radial.cot) {
        mapStore.map.scrollZoom.disable();
        mapStore.map.touchZoomRotate.disableRotation();
        mapStore.map.dragRotate.disable();
        mapStore.map.dragPan.disable();
        locked.value.push(mapStore.radial.cot.properties.id);
    } else {
        mapStore.map.scrollZoom.enable();
        mapStore.map.touchZoomRotate.enableRotation();
        mapStore.map.dragRotate.enable();
        mapStore.map.dragPan.enable();
        locked.value.pop();
    }
})

watch(search.value.filter, async () => {
    await fetchSearch();
});

onMounted(async () => {
    // ensure uncaught errors in the stack are captured into vue context
    window.addEventListener('error', (evt) => {
        evt.preventDefault();
        emit('err', new Error(evt.message));
    });

    window.addEventListener('resize', () => {
        height.value = window.innerHeight;
        width.value = window.innerWidth;
    });

    await mountMap();

    await Promise.all([
        profileStore.loadChannels(),
        cotStore.loadArchive()
    ]);

    warnChannels.value = profileStore.hasNoChannels;
    warnConfiguration.value = profileStore.hasNoConfiguration;

    loading.value = false;

    if ('Notification' in window && Notification && Notification.permission !== 'granted') {
        Notification.requestPermission()
    }

    if (("geolocation" in navigator)) {
        navigator.geolocation.watchPosition((position) => {
            if (position.coords.accuracy <= 50) {
                live_loc.value = {
                    type: 'Feature',
                    properties: {
                        accuracy: position.coords.accuracy
                    },
                    geometry: {
                        type: 'Point',
                        coordinates: [
                            position.coords.longitude,
                            position.coords.latitude
                        ],
                    }
                }

                setYou(live_loc.value);
            }
        }, (err) => {
            if (err.code === 0) {
                live_loc_denied.value = true;
            } else if (!err.code) {
                emit('err', err);
            }
        },{
            maximumAge: 0,
            timeout: 1500,
            enableHighAccuracy: true
        });
    } else {
        console.error('geolocation object not found on navigator');
    }

    window.addEventListener('dragover', (e) => {
        e.preventDefault();

        const dt = e.dataTransfer;
        if (dt.types && (dt.types.indexOf ? dt.types.indexOf('Files') != -1 : dt.types.contains('Files'))) {
            upload.value.shown = true;
            upload.value.dragging = true;
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.key == 'Escape') {
            if (mapStore.radial.mode) {
                closeRadial()
            } else if (mapStore.select.feats) {
                mapStore.select.feats = [];
            } else if (route.path.startsWith("/")) {
                router.push("/");
            }
        }
    });

    connectionStore.connectSocket(profileStore.profile.username);
});

onBeforeUnmount(() => {
    if (timer.value) window.clearInterval(timer.value);
    if (timerSelf.value) window.clearInterval(timerSelf.value);
    if (connectionStore.ws) connectionStore.ws.close();

    cotStore.$reset();
    mapStore.destroy();
});

function selectFeat(selectedFeat: MapGeoJSONFeature) {
    mapStore.select.feats = [];
    const source = mapStore.featureSource(feat);

    if (source === 'cot') {
        router.push(`/cot/${selectedFeat.properties.id}`);
    } else {
        feat.value = selectedFeat;
    }
}

function closeAllMenu() {
    feat.value = false;
    router.push("/");
    pointInput.value = false;
}

function closeRadial() {
    mapStore.radial.mode = null;
    mapStore.radial.cot = null;
}

function toLocation() {
    if (live_loc.value) {
        mapStore.map.flyTo({
            center: live_loc.value.geometry.coordinates,
            zoom: 14
        });
    } else if (!profileStore.profile.tak_loc) {
        throw new Error('No Location Set');
    } else {
        mapStore.map.flyTo({
            center: profileStore.profile.tak_loc.coordinates,
            zoom: 14
        });
    }
}

function setLocation() {
    mode.value = 'SetLocation';
    mapStore.map.getCanvas().style.cursor = 'pointer'
    mapStore.map.once('click', async (e) => {
        mapStore.map.getCanvas().style.cursor = ''
        mode.value = 'Default';
        await profileStore.update({
            tak_loc: {
                type: 'Point',
                coordinates: [e.lngLat.lng, e.lngLat.lat]
            }
        })

        setYou();
    });
}

function fileUpload(event) {
    upload.value.shown = false;
    const imp = JSON.parse(event);
    router.push(`/menu/imports/${imp.id}`)
}

async function fetchSearch(query?: string, magicKey?: string) {
    if (!magicKey || !query) {
        const url = stdurl('/api/search/suggest');
        url.searchParams.append('query', search.value.filter);
        search.value.results = ((await std(url)) as SearchSuggest).items;
    } else {
        const url = stdurl('/api/search/forward');
        url.searchParams.append('query', query);
        url.searchParams.append('magicKey', magicKey);
        const items = ((await std(url)) as SearchForward).items;

        search.value.shown = false;
        search.value.filter = '';
        search.value.results = [];

        if (items.length) {
            mapStore.map.fitBounds([
                [items[0].extent.xmin, items[0].extent.ymin],
                [items[0].extent.xmax, items[0].extent.ymax],
            ], {
                duration: 0,
                padding: {top: 25, bottom:25, left: 25, right: 25}
            });
        }
    }
}

function getLocation() {
    if (!live_loc.value) {
        throw new Error('No Location Determined');
    } else if (live_loc_denied.value) {
        throw new Error('Cannot navigate to your position as you denied location services');
    }

    mapStore.map.flyTo({
        center: live_loc.value.geometry.coordinates,
        zoom: 14
    });
}

function startDraw(type: string) {
    if (!mapStore.draw) throw new Error('Drawing Tools haven\'t loaded');
    mapStore.draw.start();
    mapStore.draw.setMode(type);
    drawMode.value = type;
}

async function handleRadial(event) {
    if (event === 'cot:view') {
        router.push(`/cot/${mapStore.radial.cot.properties.id}`);
        closeRadial()
    } else if (event === 'cot:play') {
        videoStore.add(mapStore.radial.cot.properties.id);
        closeRadial()
    } else if (event === 'cot:delete') {
        const cot = mapStore.radial.cot;
        closeRadial()

        if (route.name === 'home-menu-cot' && route.params.uid === cot.id) {
            router.push('/');
        }

        await deleteCOT(cot);
    } else if (event === 'cot:edit') {
        editGeometry(mapStore.radial.cot);
        closeRadial()
    } else if (event === 'feat:view') {
        feat.value = mapStore.radial.cot;
        closeRadial()
    } else if (event === 'context:new') {
        await cotStore.add(mapStore.radial.cot);
        updateCOT();
        closeRadial()
    } else if (event === 'context:info') {
        router.push(`/query/${encodeURIComponent(mapStore.radial.cot.geometry.coordinates.join(','))}`);
        closeRadial()
    } else {
        closeRadial()
        throw new Error(`Unimplemented Radial Action: ${event}`);
    }
}

function editGeometry(cot: COT) {
    if (!mapStore.draw) throw new Error('Drawing Tools haven\'t loaded');

    const feat = cotStore.get(cot.id, { clone: true });

    if (!feat) return;

    mapStore.edit = cot;
    mapStore.draw.start();
    mapStore.draw.setMode('select');
    drawMode.value = 'select';

    if (feat.geometry.type === 'Polygon') {
        feat.properties.mode = 'polygon';
    } else if (feat.geometry.type === 'LineString') {
        feat.properties.mode = 'linestring';
    } else if (feat.geometry.type === 'Point') {
        feat.properties.mode = 'point';

        // TODO: Eventually retain if unchanged or just drop, not sure what's best
        if (feat.geometry.coordinates.length > 2) {
            feat.geometry.coordinates.splice(2);
        }
    }

    cotStore.hidden.add(feat.id);
    updateCOT();
    try {
        mapStore.draw.addFeatures([feat.as_feature()]);
        mapStore.draw.selectFeature(feat.id);
    } catch (err) {
        mapStore.draw.setMode('static');
        throw err
    }
}

async function deleteCOT(cot) {
    await cotStore.delete(cot.properties.id)
    await updateCOT();
}

async function updateCOT() {
    try {
        const diff = cotStore.diff();

        if (diff.add.length || diff.remove.length || diff.update.length) {
            mapStore.map.getSource('-1').updateData(diff);
        }

        if (locked.value.length && cotStore.has(locked.value[locked.value.length - 1])) {
            const flyTo = {
                center: cotStore.get(locked.value[locked.value.length - 1]).properties.center,
                speed: Infinity
            };
            mapStore.map.flyTo(flyTo);

            if (mapStore.radial.mode) {
                mapStore.radial.x = mapStore.container ? mapStore.container.clientWidth / 2 : 0;
                mapStore.radial.y = mapStore.container ? mapStore.container.clientHeight / 2 : 0;
            }
        }
    } catch (err) {
        console.error(err);
    }
}

function setYou(feat?: Feature) {
    if (!feat && profileStore.profile.tak_loc) {
        connectionStore.sendCOT(profileStore.CoT());

        const youSource = mapStore.map.getSource('0');
        if (youSource) {
            youSource.setData({
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    properties: {
                        accuracy: 10
                    },
                    geometry: profileStore.profile.tak_loc
                }]
            });
        }
    } else if (feat) {
        connectionStore.sendCOT(profileStore.CoT(feat));

        const youSource = mapStore.map.getSource('0');
        if (youSource) {
            youSource.setData({
                type: 'FeatureCollection',
                features: [feat]
            });
        }
    }
}

function mountMap(): Promise<void> {
    return new Promise((resolve) => {
        mapStore.init(mapRef);

        mapStore.map.once('idle', async () => {
            // Eventually make a sprite URL part of the overlay so KMLs can load a sprite package & add paging support
            const iconsets = await std('/api/iconset') as IconsetList;
            for (const iconset of iconsets.items) {
                mapStore.map.addSprite(iconset.uid, String(stdurl(`/api/icon/sprite?token=${localStorage.token}&iconset=${iconset.uid}&alt=true`)))
            }

            await mapStore.initOverlays();
            mapStore.initDraw();

            setYou();

            mapStore.draw.on('deselect', async () => {
                if (!mapStore.edit) return;

                const feat = mapStore.draw._store.store[mapStore.edit.id];
                delete feat.properties.center;

                cotStore.hidden.delete(mapStore.edit.id);

                mapStore.edit = null

                mapStore.draw.setMode('static');
                drawMode.value = 'static';
                mapStore.draw.stop();

                cotStore.cots.delete(feat.id);
                cotStore.add(feat);
                await updateCOT();
            })

            mapStore.draw.on('finish', async (id: string) => {
                if (mapStore.draw.getMode() === 'select' || mapStore.edit) {
                    return;
                } else if (mapStore.draw.getMode() === 'freehand') {
                    const geometry = mapStore.draw._store.store[id].geometry;
                    mapStore.draw._store.delete([id]);
                    mapStore.draw.setMode('static');
                    drawMode.value = 'static';
                    mapStore.draw.stop();

                    cotStore.touching(geometry).forEach((feat) => {
                        mapStore.selected.set(feat.id, feat);
                    })

                    return;
                }

                const geometry = mapStore.draw._store.store[id].geometry;

                const feat = {
                    id: id,
                    type: 'Feature',
                    how: 'h-g-i-g-o',
                    properties: {
                        archived: true,
                        callsign: 'New Feature'
                    },
                    geometry
                };

                if (
                    mapStore.draw.getMode() === 'polygon'
                    || mapStore.draw.getMode() === 'angled-rectangle'
                    || mapStore.draw.getMode() === 'sector'
                ) {
                    feat.properties.type = 'u-d-f';
                } else if (mapStore.draw.getMode() === 'linestring') {
                    feat.properties.type = 'u-d-f';
                } else if (mapStore.draw.getMode() === 'point') {
                    feat.properties.type = drawModePoint.value || 'u-d-p';
                    feat.properties["marker-opacity"] = 1;
                    feat.properties["marker-color"] = '#00FF00';
                }

                mapStore.draw._store.delete([id]);
                mapStore.draw.setMode('static');
                drawMode.value = 'static';
                mapStore.draw.stop();
                await cotStore.add(feat);
                await updateCOT();
            });

            timerSelf.value = setInterval(() => {
                if (live_loc.value) {
                    connectionStore.sendCOT(profileStore.CoT(live_loc.value))
                } else if (profileStore.profile && profileStore.profile.tak_loc) {
                    connectionStore.sendCOT(profileStore.CoT());
                }
            }, 2000);

            timer.value = setInterval(async () => {
                if (!mapStore.map) return;
                await updateCOT();
            }, 500);

            return resolve();
        });
    });
}
</script>
