<template>
    <div
        class='d-flex position-relative'
        style='height: calc(100vh) !important;'
        :style='{
            "--map-side-offset": `${mapSideOffset}px`,
            "--map-compact-menu-size": "60px",
            "--map-bottom-bar-size": "50px"
        }'
        data-bs-theme-base='neutral'
        data-bs-theme-primary='blue'
    >
        <div
            ref='map'
            style='width: 100%;'
        />

        <MapLoading v-if='loading || !mapStore.isLoaded' />

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
                v-if='mapStore.draw.mode !== DrawToolMode.STATIC'
            />

            <GeoJSONInput
                v-if='mapStore.toImport.length'
                :features='mapStore.toImport'
                @close='mapStore.toImport = []'
                @done='mapStore.toImport = []'
            />

            <GenericBottomPane v-if='mode === "SetLocation"'>
                <div
                    class='card user-select-none text-white cloudtak-bg rounded-top'
                >
                    <div class='card-header'>
                        <div class='col-8'>
                            <IconLocationPin
                                class='me-2'
                                :size='20'
                            />
                            <span>Click on the map to {{ mapStore.location === LocationState.Preset ? 'update' : 'set' }} your location</span>
                        </div>
                        <div class='col-4 d-flex align-items-center'>
                            <div class='ms-auto btn-list'>
                                <button
                                    class='btn btn-sm use-gps-btn'
                                    @click='exitManualMode'
                                >
                                    <IconLocation
                                        :size='16'
                                        class='me-1'
                                    />
                                    Use GPS
                                </button>
                                <TablerIconButton
                                    title='Cancel Manual Location'
                                    @click='cancelLocationSetting'
                                >
                                    <IconX
                                        :size='24'
                                        stroke='1'
                                    />
                                </TablerIconButton>
                            </div>
                        </div>
                    </div>
                </div>
            </GenericBottomPane>
            <BottomBar
                :mode='mode'
                :mouse-coord='mouseCoord'
                @set-location='setLocation'
                @to-location='toLocation'
            />
            <div
                v-if='mapStore.selected.size'
                class='position-absolute begin-0 text-white cloudtak-bg'
                style='
                    bottom: var(--map-bottom-bar-size, 50px);
                    width: 250px;
                '
            >
                <SelectFeats :selected='mapStore.selected' />
            </div>

            <div
                v-if='mode === "Default"'
                class='position-absolute top-0 beginning-0 text-white'
            >
                <ActiveMission />
            </div>
            <div
                v-if='mode === "Default"'
                class='position-absolute beginning-0 text-white'
                style='
                    top: 60px;
                '
            >
                <div
                    class='border'
                    style='
                        z-index: 1;
                        width: 40px;
                        background-color: rgba(0, 0, 0, 0.2);
                        border-radius: 0px 0px 6px 0px;
                    '
                >
                    <div>
                        <IconSearch
                            v-tooltip='"Search"'
                            tabindex='0'
                            title='Search Button'
                            :size='32'
                            stroke='2'
                            :color='searchBoxShown ? "#1E90FF" : "#ffffff"'
                            style='margin: 3px 2px'
                            class='cursor-pointer cloudtak-hover'
                            @click='searchBoxShown = !searchBoxShown'
                        />
                    </div>

                    <div
                        style='margin: 3px 3px'
                        class='cursor-pointer cloudtak-hover'
                        @click='toggleCompass'
                    >
                        <IconCompass
                            v-if='mapStore.userOrientationMode'
                            v-tooltip='"Orient North"'
                            tabindex='0'
                            :size='32'
                            stroke='2'
                            color='#1E90FF'
                        />
                        <template v-else>
                            <IconCircleArrowUp
                                v-tooltip='"Snap to North"'
                                tabindex='0'
                                :alt='`Map Rotated to ${humanBearing}`'
                                :transform='`rotate(${360 - mapStore.bearing})`'
                                :size='32'
                                stroke='2'
                                :color='mapStore.bearing === 0 ? "#ffffff" : undefined'
                            />
                            <div
                                v-if='mapStore.bearing !== 0'
                                class='text-center'
                                v-text='humanBearing'
                            />
                        </template>
                    </div>
                    <div
                        v-if='mapStore.pitch !== 0'
                        style='margin: 3px 3px'
                        class='cursor-pointer cloudtak-hover'
                        @click='mapStore.map.setPitch(0)'
                    >
                        <IconAngle
                            v-tooltip='"Snap Flat"'
                            tabindex='0'
                            :alt='`Map Pitch to ${humanPitch}`'
                            :size='32'
                            stroke='2'
                        />
                        <div
                            v-if='mapStore.pitch !== 0'
                            class='text-center'
                            v-text='humanPitch'
                        />
                    </div>
                    <div
                        v-if='displayZoom'
                    >
                        <IconPlus
                            v-tooltip='"Zoom In"'
                            role='button'
                            tabindex='0'
                            title='Zoom In Button'
                            :size='32'
                            stroke='2'
                            class='cursor-pointer cloudtak-hover'
                            style='margin: 3px 3px'
                            @click='mapStore.map.setZoom(mapStore.map.getZoom() + 1);'
                        />
                        <IconMinus
                            v-tooltip='"Zoom Out"'
                            role='button'
                            tabindex='0'
                            title='Zoom Out Button'
                            :size='32'
                            stroke='2'
                            class='cursor-pointer cloudtak-hover'
                            style='margin: 3px 3px'
                            @click='mapStore.map.setZoom(mapStore.map.getZoom() - 1);'
                        />
                    </div>

                    <IconMountain
                        v-if='mapStore.hasTerrain'
                        v-tooltip='mapStore.isTerrainEnabled ? "Disable 3D Terrain" : "Enable 3D Terrain"'
                        role='button'
                        tabindex='0'
                        title='3D Terrain'
                        :size='32'
                        stroke='2'
                        class='cursor-pointer cloudtak-hover'
                        :color='mapStore.isTerrainEnabled ? "#1E90FF" : "#FFFFFF"'
                        style='margin: 3px 3px'
                        @click='mapStore.isTerrainEnabled ? mapStore.removeTerrain() : mapStore.addTerrain()'
                    />

                    <IconLockAccess
                        v-if='
                            (mapStore.radial.cot && mapStore.locked.length >= 2)
                                || (!mapStore.radial.cot && mapStore.locked.length >= 1)
                        '
                        v-tooltip='"Map is locked to marker - Click to Unlock"'
                        title='Map is locked to marker - Click to Unlock'
                        class='cursor-pointer cloudtak-hover'
                        role='button'
                        tabindex='0'
                        color='red'
                        :size='32'
                        stroke='2'
                        style='margin: 3px 3px'
                        @click='mapStore.locked.splice(0, mapStore.locked.length)'
                    />
                </div>
            </div>

            <TablerModal
                v-if='searchBoxShown'
                size='lg'
            >
                <div class='modal-header'>
                    <div class='modal-title'>
                        Search
                    </div>
                    <button
                        type='button'
                        class='btn-close'
                        aria-label='Close'
                        @click='searchBoxShown = false'
                    />
                </div>
                <div class='modal-body'>
                    <SearchBox
                        :autofocus='true'
                        @select='searchBoxShown = false'
                    />
                </div>
            </TablerModal>

            <div
                v-if='mapStore.isLoaded && mode === "Default"'
                class='d-flex position-absolute top-0 text-white'
                style='
                    z-index: 5;
                    width: 120px;
                    height: 60px;
                    right: var(--map-compact-menu-size, 60px);
                    padding-left: 10px;
                    background-color: rgba(0, 0, 0, 0.5);
                    border-radius: 0px 0px 0px 6px;
                    padding-top: 8px;
                '
            >
                <TablerDropdown>
                    <TablerIconButton
                        id='map-notifications'
                        title='Notifications Icon'
                        class='cloudtak-hover'
                        :class='{ "alert-pulse": alertNotifications }'
                        :hover='false'
                    >
                        <IconAlertTriangle
                            v-if='alertNotifications'
                            :size='40'
                            stroke='1'
                            class='text-danger'
                        />
                        <IconBell
                            v-else
                            :size='40'
                            stroke='1'
                        />
                    </TablerIconButton>
                    <template #dropdown>
                        <Notifications />
                    </template>
                </TablerDropdown>

                <span
                    v-if='notifications'
                    class='badge bg-red mb-2'
                />
                <span
                    v-else
                    style='width: 10px;'
                />

                <DrawTools />
            </div>

            <div
                v-if='mode === "Default"'
                class='position-absolute top-0 end-0 text-white'
                style='
                    z-index: 1;
                    width: var(--map-compact-menu-size, 60px);
                    height: 60px;
                    background-color: rgba(0, 0, 0, 0.5);
                    padding-top: 8px;
                '
            >
                <TablerIconButton
                    v-if='noMenuShown'
                    title='Open Menu'
                    class='mx-2 cloudtak-hover'
                    :hover='false'
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
                    class='mx-2 cursor-pointer'
                    @click='closeAllMenu'
                >
                    <IconX
                        :size='40'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>


            <MainMenu
                v-if='
                    mapStore.isLoaded
                        && (
                            (noMenuShown && !isMobileDetected)
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
                @close='closeRadial'
                @click='handleRadial($event)'
            />

            <template
                v-for='float in floatStore.panes.values()'
                :key='float.uid'
            >
                <component
                    :is='float.component'
                    :uid='float.uid'
                    @close='floatStore.panes.delete(float.uid)'
                />
            </template>

            <BufferInput
                v-if='bufferCotId'
                :cot-id='bufferCotId'
                @close='bufferCotId = null'
            />

            <template v-if='upload.shown'>
                <TablerModal>
                    <div class='modal-status bg-red' />
                    <button
                        type='button'
                        class='btn-close'
                        aria-label='Close'
                        @click='upload.shown = false'
                    />
                    <div class='modal-body text-body'>
                        <Upload
                            :url='stdurl("/api/import")'
                            :headers='{ Authorization: `Bearer ${token}` }'
                            method='PUT'
                            :cancel='false'
                            @cancel='upload.shown = false'
                            @done='fileUpload($event)'
                        />
                    </div>
                </TablerModal>
            </template>
        </template>
    </div>
</template>

<script setup lang='ts'>
import GeoJSONInput from './Inputs/GeoJSONInput.vue';
import BufferInput from './Inputs/BufferInput.vue';
import { ref, watch, computed, toRaw, onMounted, onBeforeUnmount, useTemplateRef } from 'vue';
import BottomBar from './BottomBar/BottomBar.vue';
import {useRoute, useRouter } from 'vue-router';
import ActiveMission from './ActiveMission.vue';
import DrawOverlay from './util/DrawOverlay.vue';
import WarnChannels from './util/WarnChannels.vue';
import Notifications from './Notifications.vue';
import SearchBox from './util/SearchBox.vue';
import WarnConfiguration from './util/WarnConfiguration.vue';
import DrawTools from './DrawTools.vue';
import GenericBottomPane from './GenericBottomPane.vue';
import type { MapGeoJSONFeature, LngLatLike, MapMouseEvent } from 'maplibre-gl';
import type { Feature } from '../../types.ts';
import {
    IconCircleArrowUp,
    IconAlertTriangle,
    IconLocationPin,
    IconLockAccess,
    IconLocation,
    IconMountain,
    IconCompass,
    IconSearch,
    IconMinus,
    IconMenu2,
    IconAngle,
    IconPlus,
    IconBell,
    IconX,
} from '@tabler/icons-vue';
import SelectFeats from './util/SelectFeats.vue';
import MultipleSelect from './util/MultipleSelect.vue';
import MainMenu from './MainMenu.vue';
import { from } from 'rxjs';
import { useObservable } from '@vueuse/rxjs';
import {
    TablerIconButton,
    TablerDropdown,
    TablerModal,
} from '@tak-ps/vue-tabler';
import { LocationState } from '../../base/events.ts';
import TAKNotification, { NotificationType } from '../../base/notification.ts';
import { v4 as randomUUID } from 'uuid';
import { lineString as turfLineString, point as turfPoint } from '@turf/helpers';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import lineSplit from '@turf/line-split';
import COT from '../../base/cot.ts';
import MapLoading from './MapLoading.vue';
import 'maplibre-gl/dist/maplibre-gl.css';
import RadialMenu from './RadialMenu/RadialMenu.vue';
import { useMapStore } from '../../stores/map.ts';
import { DrawToolMode } from '../../stores/modules/draw.ts';
import { useFloatStore } from '../../stores/float.ts';
import { liveQuery } from 'dexie';
import Upload from '../util/Upload.vue';
import { stdurl } from '../../std.ts';
import ProfileConfig from '../../base/profile.ts';
import { cutOverlayFeature } from './util/featureCut.ts';

const mapStore = useMapStore();
const floatStore = useFloatStore();
const token = computed(() => String(localStorage.token ?? ''));
const router = useRouter();
const route = useRoute();

const emit = defineEmits(['err']);

const mode = ref<string>('Default');
const locationClickHandler = ref<((e: MapMouseEvent) => void) | null>(null);
const height = ref<number>(window.innerHeight);
const width = ref<number>(window.innerWidth);

mapStore.isMobileDetected = detectMobile();

// Show a popup if no channels are selected on load
const warnChannels = ref<boolean>(false)

// Show a popup if role/groups hasn't been set
const warnConfiguration = ref<boolean>(false);

const searchBoxShown = ref(false);

const upload = ref({
    shown: false,
    dragging: false
})

const bufferCotId = ref<string | null>(null)

const loading = ref(true)

const notifications = useObservable<number>(
    from(liveQuery(async () => {
        return await TAKNotification.count()
    }))
);

const alertNotifications = useObservable<number>(
    from(liveQuery(async () => {
        return await TAKNotification.countByType(NotificationType.Alert)
    }))
);

function detectMobile() {
  //TODO: This needs to follow something like:
  // https://stackoverflow.com/questions/47219272/how-can-i-monitor-changing-window-sizes-in-vue
    return (
        ( width.value <= 576 )
        || ( height.value <= 576 )
    );
}

const isMobileDetected = computed(() => {
    return detectMobile();
});

watch(isMobileDetected, () => {
    mapStore.isMobileDetected = isMobileDetected.value;
});

const displayZoom = computed(() => {
    if (mapStore.zoom === 'conditional') {
        return isMobileDetected;
    } else {
        return mapStore.zoom === 'always' ? true : false;
    }
})


const humanBearing = computed(() => {
    if (mapStore.bearing < 0) {
        return Math.round(mapStore.bearing * -1) + '°'
    } else {
        return Math.round(360 - mapStore.bearing) + '°';
    }
})

const humanPitch = computed(() => {
    return Math.round(mapStore.pitch) + '°'
})

const toggleCompass = () => {
    if (mapStore.userOrientationMode) {
        mapStore.userOrientationMode = false;
        mapStore.map.setBearing(0);
    } else if (mapStore.bearing !== 0) {
        mapStore.map.setBearing(0);
    } else {
        // Was at bearing 0, now enable user orientation mode
        mapStore.userOrientationMode = true;
    }
}

const mapRef = useTemplateRef<HTMLElement>('map');

const mouseCoord = ref<{ lat: number; lng: number } | null>(null);

const noMenuShown = computed<boolean>(() => {
    return (!route.name || !String(route.name).startsWith('home-menu'))
});

const mapSideOffset = computed(() => {
    if (isMobileDetected.value) return 0;

    // `toastOffset.x` includes a 10px buffer for notification toasts.
    // Remove that padding so right-side map controls align flush with the visible menu edge.
    return Math.max(mapStore.toastOffset.x - 10, 0);
});

onMounted(async () => {
    // ensure uncaught errors in the stack are captured into vue context
    window.addEventListener('error', (evt) => {
        console.error(evt);
        evt.preventDefault();
        emit('err', new Error(evt.message));
    });

    window.addEventListener('resize', () => {
        height.value = window.innerHeight;
        width.value = window.innerWidth;
    });

    if (!mapRef.value) throw new Error('Map Element could not be found - Please refresh the page and try again');
    await mapStore.init(mapRef.value);

    mapStore.map.on('mousemove', (e) => {
        mouseCoord.value = {
            lat: e.lngLat.lat,
            lng: e.lngLat.lng,
        };
    });

    mapStore.map.on('mouseleave', () => {
        mouseCoord.value = null;
    });

    // TODO these are no longer reactive, does it matter?
    warnChannels.value = await mapStore.worker.profile.hasNoChannels();
    warnConfiguration.value = await mapStore.worker.profile.hasNoConfiguration();

    loading.value = false;

    window.addEventListener('dragover', (e) => {
        e.preventDefault();

        const dt = e.dataTransfer;
        if (dt && dt.types && (dt.types.indexOf ? dt.types.indexOf('Files') != -1 : dt.types.includes('Files'))) {
            upload.value.shown = true;
            upload.value.dragging = true;
        }
    });

    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            searchBoxShown.value = true;
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.key == 'Escape') {
            if (searchBoxShown.value) {
                searchBoxShown.value = false;
            } else if (mapStore.radial.mode) {
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
    // Clean up GPS watch
    if (mapStore.gpsWatchId !== null) {
        navigator.geolocation.clearWatch(mapStore.gpsWatchId);
    }

    mapStore.destroy();
});

function selectFeat(selectedFeat: MapGeoJSONFeature | COT) {
    mapStore.select.feats = [];

    if (selectedFeat instanceof COT) {
        router.push(`/cot/${selectedFeat.properties.id}`);
    } else {
        mapStore.viewedFeature = selectedFeat;
        router.push(`/menu/feature`);
    }
}

function closeAllMenu() {
    router.push('/');
}

function closeRadial() {
    mapStore.radial.mode = undefined;
    mapStore.radial.cot = undefined;
}

async function toLocation() {
    const location = await mapStore.worker.profile.location;

    if ([LocationState.Preset, LocationState.Live].includes(location.source)) {
        mapStore.map.flyTo({
            center: location.coordinates as LngLatLike,
            zoom: 14
        });
    } else {
        throw new Error('No Location Set or Location could not be retrieved');
    }
}

function setLocation() {
    // Always enter manual location setting mode when button is clicked
    mapStore.manualLocationMode = true;
    mode.value = 'SetLocation';
    mapStore.map.getCanvas().style.cursor = 'crosshair';

    // Store the handler so we can remove it later if needed
    locationClickHandler.value = async (e: MapMouseEvent) => {
        mapStore.map.getCanvas().style.cursor = '';
        mode.value = 'Default';
        locationClickHandler.value = null;

        await mapStore.worker.profile.update({
            tak_loc: {
                type: 'Point',
                coordinates: [e.lngLat.lng, e.lngLat.lat]
            }
        });

        await mapStore.refresh();
    };

    mapStore.map.once('click', locationClickHandler.value);
}

function cancelLocationSetting() {
    mode.value = 'Default';
    mapStore.map.getCanvas().style.cursor = '';

    // Remove the specific location click handler if it exists
    if (locationClickHandler.value) {
        mapStore.map.off('click', locationClickHandler.value);
        locationClickHandler.value = null;
    }
}

async function exitManualMode() {
    // Switch back to automatic GPS mode
    mapStore.manualLocationMode = false;
    mode.value = 'Default';
    mapStore.map.getCanvas().style.cursor = '';

    // Remove the specific location click handler if it exists
    if (locationClickHandler.value) {
        mapStore.map.off('click', locationClickHandler.value);
        locationClickHandler.value = null;
    }

    // Immediately set location to loading state for UI feedback
    mapStore.location = LocationState.Loading;

    // Remove current location dot from map by removing user's CoT
    const username = await ProfileConfig.get('username');
    const userUid = `ANDROID-CloudTAK-${username ? username.value : 'unknown'}`;
    await mapStore.worker.db.remove(userUid);

    // Clear manual location and wait for it to complete
    await mapStore.worker.profile.update({ tak_loc: null });

    // Restart GPS watch to ensure fresh GPS acquisition
    mapStore.startGPSWatch();

    await mapStore.refresh();
}



function fileUpload(event: unknown) {
    upload.value.shown = false;
    const imp = event as { imports: Array<{ uid: string }> };
    router.push(`/menu/imports/${imp.imports[0].uid}`)
}

async function handleRadial(event: string): Promise<void> {
    if (!mapStore.radial.cot) return;
    if (!mapStore.radial.cot.properties) mapStore.radial.cot.properties = {};

    if (event === 'cot:view') {
        router.push(`/cot/${mapStore.radial.cot.properties.id}`);
        closeRadial()
    } else if (event === 'cot:play') {
        await floatStore.addCOT(mapStore.radial.cot.properties.id);
        closeRadial()
    } else if (event === 'cot:delete') {
        const cot = mapStore.radial.cot;
        closeRadial()

        if (route.name === 'home-menu-cot' && route.params.uid === (cot.properties.id || cot.id)) {
            router.push('/');
        }

        await mapStore.worker.db.remove(String(cot.properties.id || cot.id), {
            mission: true
        })

        await mapStore.refresh();
    } else if (event === 'cot:lock') {
        mapStore.locked.push(mapStore.radial.cot.properties ? mapStore.radial.cot.properties.id : mapStore.radial.cot.id);
        closeRadial()
    } else if (event === 'cot:edit') {
        const cot = await mapStore.worker.db.get(mapStore.radial.cot.properties.id || mapStore.radial.cot.id, {
            mission: true
        })

        if (!cot) throw new Error('Cannot Find COT Marker');
        await mapStore.draw.edit(cot);

        closeRadial()
    } else if (event === 'feat:view') {
        selectFeat(mapStore.radial.cot as MapGeoJSONFeature);
        closeRadial()
    } else if (event === 'feat:cut') {
        await cutOverlayFeature(mapStore, mapStore.radial.cot as MapGeoJSONFeature);
        closeRadial()
    } else if (event === 'context:new') {
        const feat = toRaw(mapStore.radial.cot as Feature) as Feature;

        await mapStore.worker.db.add(feat, {
            authored: true
        });

        await mapStore.refresh();
        closeRadial()
    } else if (event === 'context:info') {
        // @ts-expect-error Figure out geometry.coordinates type
        router.push(`/query/${encodeURIComponent(mapStore.radial.cot.geometry.coordinates.join(','))}`);
        closeRadial()
    } else if (event === 'cot:geometry-buffer') {
        bufferCotId.value = mapStore.radial.cot.properties.id || String(mapStore.radial.cot.id);
        closeRadial();
    } else if (event === 'cot:geometry-split') {
        const cotFeat = await mapStore.worker.db.get(
            mapStore.radial.cot.properties.id || String(mapStore.radial.cot.id),
            { mission: true }
        );

        if (!cotFeat) throw new Error('Cannot find COT to split');
        if (cotFeat.geometry.type !== 'LineString') throw new Error('Can only split LineString geometries');

        const line = turfLineString(cotFeat.geometry.coordinates as [number, number][]);
        const click = turfPoint([mapStore.radial.lngLat!.lng, mapStore.radial.lngLat!.lat]);

        // Snap click to the nearest point exactly on the line, then split there
        const snapped = nearestPointOnLine(line, click);
        const split = lineSplit(line, snapped);

        if (split.features.length < 2) {
            closeRadial();
            throw new Error('Cannot split: click point is too close to a line endpoint');
        }

        const coordsA = split.features[0].geometry.coordinates as [number, number][];
        const coordsB = split.features[1].geometry.coordinates as [number, number][];

        const now = new Date();
        const idA = randomUUID();
        const idB = randomUUID();

        const baseProps = { ...cotFeat.properties };

        const featA: Feature = {
            id: idA,
            type: 'Feature',
            path: cotFeat.path || '/',
            properties: {
                ...baseProps,
                id: idA,
                callsign: `${cotFeat.properties.callsign} (1)`,
                time: now.toISOString(),
                start: now.toISOString(),
            },
            geometry: { type: 'LineString', coordinates: coordsA }
        };

        const featB: Feature = {
            id: idB,
            type: 'Feature',
            path: cotFeat.path || '/',
            properties: {
                ...baseProps,
                id: idB,
                callsign: `${cotFeat.properties.callsign} (2)`,
                time: now.toISOString(),
                start: now.toISOString(),
            },
            geometry: { type: 'LineString', coordinates: coordsB }
        };

        closeRadial();
        await mapStore.worker.db.remove(String(cotFeat.id), { mission: true });
        await mapStore.worker.db.add(featA, { authored: true });
        await mapStore.worker.db.add(featB, { authored: true });
        await mapStore.refresh();
    } else {
        closeRadial()
        throw new Error(`Unimplemented Radial Action: ${event}`);
    }
}

</script>

<style>
@keyframes alert-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
}

.alert-pulse {
    animation: alert-pulse 1.2s ease-in-out infinite;
}

.maplibregl-ctrl-scale {
    background-color: transparent !important;
    color: #ffffff;
    text-align: center;
    text-shadow: 1px 0 0 black, -1px 0 0 black, 0 1px 0 black, 0 -1px 0 black;
    border-bottom: 1px solid #fff;
    border-left: 1px solid #fff;
    border-right: 1px solid #fff;
    margin: 0;
}

.maplibregl-ctrl-scale::before {
    background-color: transparent !important;
    border-bottom: 1px solid #000;
    border-left: 1px solid #000;
    border-right: 1px solid #000;
    content: "";
    display: block;
    position: absolute;
    top: 0px;
    left: 1px;
    right: 1px;
    bottom: 1px;
}

.maplibregl-ctrl-bottom-left {
    bottom: calc(var(--map-bottom-bar-size, 50px) + 4px);
    left: 8px;
    right: auto;
    margin: 0;
    z-index: 3 !important;
    pointer-events: none;
}

.maplibregl-ctrl-bottom-right {
    bottom: calc(var(--map-bottom-bar-size, 50px) + 4px);
    right: calc(var(--map-side-offset, 0px) + 8px);
    left: auto;
    z-index: 3 !important;
    color: black !important;
}

.maplibregl-ctrl-attrib a {
    color: black !important;
}

html[data-bs-theme='dark'] .use-gps-btn {
    --bs-btn-color: rgba(255, 255, 255, 0.92);
    --bs-btn-border-color: rgba(255, 255, 255, 0.35);
    --bs-btn-hover-color: #182433;
    --bs-btn-hover-bg: rgba(255, 255, 255, 0.92);
    --bs-btn-hover-border-color: rgba(255, 255, 255, 0.92);
}

html[data-bs-theme='light'] .use-gps-btn {
    --bs-btn-color: var(--tblr-body-color);
    --bs-btn-border-color: var(--tblr-border-color);
    --bs-btn-hover-color: var(--tblr-bg-surface);
    --bs-btn-hover-bg: var(--tblr-primary);
    --bs-btn-hover-border-color: var(--tblr-primary);
}

@media (max-width: 600px) {
    .maplibregl-ctrl-bottom-left {
        left: 4px;
    }

    .maplibregl-ctrl-bottom-right {
        right: 4px;
    }
}
</style>
