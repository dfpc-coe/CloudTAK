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

            <DrawOverlay
                v-if='mapStore.drawOptions.mode !== "static"'
            />
            <div
                v-else-if='profileStore.profile'
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
                        v-if='profileStore.live_loc'
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
                        @click='setLocation'
                    >
                        <IconLocationOff
                            v-if='!profileStore.profile.tak_loc'
                            title='Set Your Location Button (No Location currently set)'
                            :size='20'
                            stroke='1'
                        />
                        <IconLocation
                            v-else
                            title='Set Your Location Button'
                            :size='20'
                            stroke='1'
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
                        :color='searchBoxShown ? "#1E90FF" : "#FFFFFF"'
                        style='margin: 5px 8px'
                        class='cursor-pointer hover-button'
                        @click='searchBoxShown = !searchBoxShown'
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
                        color='#83b7e8'
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

            <SearchBox
                v-if='searchBoxShown'
                style='
                    z-index: 1;
                    top: 8px;
                    left: 70px;
                    width: 200px;
                '
                @close='searchBoxShown = false'
            />

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
                        <TablerIconButton
                            title='Geometry Editing'
                            class='mx-2 cursor-pointer hover-button'
                            @click='closeAllMenu'
                        >
                            <IconPencil
                                :size='40'
                                stroke='1'
                            />
                        </TablerIconButton>
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
                <TablerIconButton
                    v-if='noMenuShown'
                    title='Open Menu'
                    class='mx-2 cursor-pointer hover-button'
                    @click='router.push("/menu")'
                >
                    <IconMenu2
                        :size='40'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerIconButton
                    v-else
                    title='Close Menu'
                    class='mx-2 cursor-pointer hover-button'
                    @click='closeAllMenu'
                >
                    <IconX
                        :size='40'
                        stroke='1'
                    />
                </TablerIconButton>
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
                v-if='feat && mode === "Default" && route.name === "home"'
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
import DrawOverlay from './util/DrawOverlay.vue';
import WarnChannels from './util/WarnChannels.vue';
import SearchBox from './util/SearchBox.vue';
import WarnConfiguration from './util/WarnConfiguration.vue';
import Status from '../util/Status.vue';
import CoordInput from './CoordInput.vue';
import type { MapGeoJSONFeature, GeoJSONSource, LngLatLike } from 'maplibre-gl';
import { std, stdurl } from '../..//std.ts';
import type { IconsetList, Feature } from '../../types.ts';
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
    TablerIconButton,
    TablerDropdown,
    TablerModal,
    TablerNone,
} from '@tak-ps/vue-tabler';
import Loading from './Loading.vue';
import 'maplibre-gl/dist/maplibre-gl.css';
import RadialMenu from './RadialMenu/RadialMenu.vue';
import { useMapStore } from '../../stores/map.ts';
import { useVideoStore } from '../../stores/videos.ts';
import { useProfileStore } from '../../stores/profile.ts';
import UploadImport from './util/UploadImport.vue'
import { coordEach } from '@turf/meta';
const profileStore = useProfileStore();
const mapStore = useMapStore();
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

const searchBoxShown = ref(false);
const pointInput = ref<boolean>(false);
const feat = ref()        // Show the Feat Viewer sidebar


// Lock the map view to a given CoT - The last element is the currently locked value
// this is an array so that things like the radial menu can temporarily lock state but remember the previous lock value when they are closed
const locked = ref<Array<string>>([])

const live_loc_denied = ref(false)   // User denied live location services
const upload = ref({
    shown: false,
    dragging: false
})

// Interval for pushing GeoJSON Map Updates (CoT)
const timer = ref<ReturnType<typeof setInterval> | undefined>()

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

const mapRef = useTemplateRef<HTMLElement>('map');

const noMenuShown = computed<boolean>(() => {
    return !feat.value
        && !pointInput.value
        && (!route.name || !String(route.name).startsWith('home-menu'))
});

watch(mapStore.radial, () => {
    if (mapStore.radial.cot) {
        mapStore.map.scrollZoom.disable();
        mapStore.map.touchZoomRotate.disableRotation();
        mapStore.map.dragRotate.disable();
        mapStore.map.dragPan.disable();

        const id = mapStore.radial.cot.properties ? mapStore.radial.cot.properties.id : mapStore.radial.cot.id;
        if (!locked.value.includes(id)) {
            locked.value.push(mapStore.radial.cot.properties ? mapStore.radial.cot.properties.id : mapStore.radial.cot.id);
        }
    } else {
        mapStore.map.scrollZoom.enable();
        mapStore.map.touchZoomRotate.enableRotation();
        mapStore.map.dragRotate.enable();
        mapStore.map.dragPan.enable();
        locked.value.pop();
    }
})

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

    await mapStore.worker.init(localStorage.token);

    // TODO these are no longer reactive, does it matter?
    warnChannels.value = await mapStore.worker.profile.hasNoChannels();
    warnConfiguration.value = await mapStore.worker.profile.hasNoConfiguration();

    loading.value = false;

    if ('Notification' in window && Notification && Notification.permission !== 'granted') {
        Notification.requestPermission()
    }

    if (("geolocation" in navigator)) {
        navigator.geolocation.watchPosition((position) => {
            if (position.coords.accuracy <= 50) {
                profileStore.live_loc = [ position.coords.longitude, position.coords.latitude ]
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
        if (dt && dt.types && (dt.types.indexOf ? dt.types.indexOf('Files') != -1 : dt.types.includes('Files'))) {
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
});

onBeforeUnmount(() => {
    if (timer.value) {
        window.clearInterval(timer.value);
    }

    mapStore.destroy();
});

function selectFeat(selectedFeat: MapGeoJSONFeature) {
    mapStore.select.feats = [];
    const source = mapStore.featureSource(selectedFeat);

    if (source === 'cot') {
        router.push(`/cot/${selectedFeat.properties.id}`);
    } else {
        router.push(`/`);
        feat.value = selectedFeat;
    }
}

function closeAllMenu() {
    feat.value = false;
    router.push("/");
    pointInput.value = false;
}

function closeRadial() {
    mapStore.radial.mode = undefined;
    mapStore.radial.cot = undefined;
}

function toLocation() {
    if (profileStore.live_loc) {
        mapStore.map.flyTo({
            center: profileStore.live_loc as LngLatLike,
            zoom: 14
        });
    } else if (!profileStore.profile || !profileStore.profile.tak_loc) {
        throw new Error('No Location Set or Location could not be retrieved');
    } else if (profileStore.profile && profileStore.profile.tak_loc) {
        mapStore.map.flyTo({
            center: profileStore.profile.tak_loc.coordinates as LngLatLike,
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

        await mapStore.worker.profile.update({
            tak_loc: {
                type: 'Point',
                coordinates: [e.lngLat.lng, e.lngLat.lat]
            }
        })

        await updateCOT();
    });
}

function fileUpload(event: string) {
    upload.value.shown = false;
    const imp = JSON.parse(event) as { id: string };
    router.push(`/menu/imports/${imp.id}`)
}

function getLocation() {
    if (profileStore.profile || !profileStore.live_loc) {
        throw new Error('No Location Determined');
    } else if (live_loc_denied.value) {
        throw new Error('Cannot navigate to your position as you denied location services');
    }

    mapStore.map.flyTo({
        center: profileStore.live_loc as LngLatLike,
        zoom: 14
    });
}

function startDraw(type: string) {
    if (!mapStore.draw) throw new Error('Drawing Tools haven\'t loaded');
    mapStore.draw.start();
    mapStore.draw.setMode(type);
    mapStore.drawOptions.mode = type;
}

async function handleRadial(event: string): Promise<void> {
    if (!mapStore.radial.cot) return;
    if (!mapStore.radial.cot.properties) mapStore.radial.cot.properties = {};

    if (event === 'cot:view') {
        router.push(`/cot/${mapStore.radial.cot.properties.id}`);
        closeRadial()
    } else if (event === 'cot:play') {
        await videoStore.add(mapStore.radial.cot.properties.id);
        closeRadial()
    } else if (event === 'cot:delete') {
        const cot = mapStore.radial.cot;
        closeRadial()

        if (route.name === 'home-menu-cot' && route.params.uid === cot.id) {
            router.push('/');
        }

        await mapStore.worker.db.remove(String(cot.id))
        await updateCOT();
    } else if (event === 'cot:lock') {
        locked.value.push(mapStore.radial.cot.properties ? mapStore.radial.cot.properties.id : mapStore.radial.cot.id);
        closeRadial()
    } else if (event === 'cot:edit') {
        await editGeometry(mapStore.radial.cot.properties ? mapStore.radial.cot.properties.id : mapStore.radial.cot.id);
        closeRadial()
    } else if (event === 'feat:view') {
        selectFeat(mapStore.radial.cot as MapGeoJSONFeature);
        closeRadial()
    } else if (event === 'context:new') {
        await mapStore.worker.db.add(mapStore.radial.cot);
        updateCOT();
        closeRadial()
    } else if (event === 'context:info') {
        // @ts-expect-error Figure out geometry.coordinates type
        router.push(`/query/${encodeURIComponent(mapStore.radial.cot.geometry.coordinates.join(','))}`);
        closeRadial()
    } else {
        closeRadial()
        throw new Error(`Unimplemented Radial Action: ${event}`);
    }
}

async function editGeometry(featid: string) {
    if (!mapStore.draw) throw new Error('Drawing Tools haven\'t loaded');

    const cot = await mapStore.worker.db.get(featid, { mission: true });
    if (!cot) return;

    try {
        mapStore.edit = cot;
        mapStore.draw.start();
        mapStore.draw.setMode('select');
        mapStore.drawOptions.mode = 'select';

        const feat = cot.as_feature({ clone: true });
        if (feat.geometry.type === 'Polygon') {
            feat.properties.mode = 'polygon';
        } else if (feat.geometry.type === 'LineString') {
            feat.properties.mode = 'linestring';
        } else if (feat.geometry.type === 'Point') {
            feat.properties.mode = 'point';
        }

        coordEach(feat, (coord) => {
            if (coord.length > 2) {
                coord.splice(2, coord.length - 2);
            }

            // Ensure precision is within bounds
            for (let i = 0; i < coord.length; i++) {
                coord[i] = Math.round(coord[i] * Math.pow(10, 9)) / Math.pow(10, 9);
            }
        });

        await mapStore.worker.db.hide(cot.id);
        updateCOT();

        const errorStatus = mapStore.draw.addFeatures([feat]).filter((status) => {
            return !status.valid;
        });

        if (errorStatus.length) {
            throw new Error('Error editing this feature: ' + errorStatus[0].reason)
        }

        mapStore.draw.selectFeature(cot.id);
    } catch (err) {
        await mapStore.worker.db.unhide(cot.id);
        mapStore.draw.setMode('static');
        updateCOT();
        mapStore.drawOptions.mode = 'static';
        mapStore.draw.stop();

        emit('err', err);
    }
}

async function updateCOT() {
    try {
        const diff = await mapStore.worker.db.diff();

        if (
            (diff.add && diff.add.length)
            || (diff.remove && diff.remove.length)
            || (diff.update && diff.update.length)
        ) {
            const source = mapStore.map.getSource('-1') as GeoJSONSource
            if (source) source.updateData(diff);
        }

        if (locked.value.length && await mapStore.worker.db.has(locked.value[locked.value.length - 1])) {
            let featid = locked.value[locked.value.length - 1];
            if (featid) {
                const feat = await mapStore.worker.db.get(featid);
                if (feat && feat.geometry.type === "Point") {
                    const flyTo = {
                        center: feat.properties.center as LngLatLike,
                        speed: Infinity
                    };
                    mapStore.map.flyTo(flyTo);

                    if (mapStore.radial.mode) {
                        mapStore.radial.x = mapStore.container ? mapStore.container.clientWidth / 2 : 0;
                        mapStore.radial.y = mapStore.container ? mapStore.container.clientHeight / 2 : 0;
                    }
                }
            }
        }
    } catch (err) {
        console.error(err);
    }
}

async function mountMap(): Promise<void> {
    if (!mapRef.value) throw new Error('Map Element could not be found - Please refresh the page and try again');
    await mapStore.init(mapRef.value);

    // Eventually make a sprite URL part of the overlay so KMLs can load a sprite package & add paging support
    const iconsets = await std('/api/iconset') as IconsetList;
    for (const iconset of iconsets.items) {
        mapStore.map.addSprite(iconset.uid, String(stdurl(`/api/icon/sprite?token=${localStorage.token}&iconset=${iconset.uid}&alt=true`)))
    }

    return new Promise((resolve) => {
        mapStore.map.once('idle', async () => {
            if (profileStore.profile && profileStore.profile.display_projection === 'globe') {
                mapStore.map.setProjection({ type: "globe" });
            }

            await mapStore.worker.db.updateImages(mapStore.map.listImages());

            await mapStore.initOverlays();
            await mapStore.initDraw();

            // Deselect event is for editing existing features
            mapStore.draw.on('deselect', async () => {
                if (!mapStore.edit) return;

                const feat = mapStore.draw.getSnapshotFeature(mapStore.edit.id);

                if (!feat) throw new Error('Could not find underlying marker');

                delete feat.properties.center;

                await mapStore.worker.db.unhide(mapStore.edit.id);

                const cot = await mapStore.worker.db.get(mapStore.edit.id, { mission: true });

                mapStore.edit = undefined

                mapStore.draw.setMode('static');
                mapStore.drawOptions.mode = 'static';
                mapStore.draw.stop();

                await mapStore.worker.db.add(feat);

                await updateCOT();
            })

            // Finish event is for creating new features
            mapStore.draw.on('finish', async (id, context) => {
                if (!mapStore.draw) throw new Error('Drawing Tools haven\'t loaded');

                if (context.action === "draw") {
                    if (mapStore.draw.getMode() === 'select' || mapStore.edit) {
                        return;
                    } else if (mapStore.draw.getMode() === 'freehand') {
                        const feat = mapStore.draw.getSnapshotFeature(id);
                        if (!feat) throw new Error('Could not find underlying marker');
                        mapStore.draw.removeFeatures([id]);
                        mapStore.draw.setMode('static');
                        mapStore.drawOptions.mode = 'static';
                        mapStore.draw.stop();

                        (await mapStore.worker.db.touching(feat.geometry)).forEach((feat) => {
                            mapStore.selected.set(feat.id, feat);
                        })

                        return;
                    }

                    const storeFeat = mapStore.draw.getSnapshotFeature(id);
                    if (!storeFeat) throw new Error('Could not find underlying marker');

                    const now = new Date();
                    const feat: Feature = {
                        id: String(id),
                        type: 'Feature',
                        path: '/',
                        properties: {
                            id: String(id),
                            type: 'u-d-p',
                            how: 'h-g-i-g-o',
                            archived: true,
                            callsign: 'New Feature',
                            time: now.toISOString(),
                            start: now.toISOString(),
                            stale: new Date(now.getTime() + 3600).toISOString(),
                            center: [0,0]
                        },
                        geometry: JSON.parse(JSON.stringify(storeFeat.geometry))
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
                        feat.properties.type = mapStore.drawOptions.pointMode || 'u-d-p';
                        feat.properties["marker-opacity"] = 1;
                        feat.properties["marker-color"] = '#00FF00';
                    }

                    mapStore.draw.removeFeatures([id]);
                    mapStore.draw.setMode('static');
                    mapStore.drawOptions.mode = 'static';
                    mapStore.draw.stop();
                    await mapStore.worker.db.add(feat);
                    await updateCOT();
                }
            });

            timer.value = setInterval(async () => {
                if (!mapStore.map) return;
                await updateCOT();
            }, 500);

            return resolve();
        });
    });
}
</script>
