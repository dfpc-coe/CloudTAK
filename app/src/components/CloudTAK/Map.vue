<template>
    <div
        class='d-flex position-relative map-shell'
        style='height: calc(100vh) !important;'
        :style='{
            "--map-side-offset": `${mapSideOffset}px`,
            "--map-compact-menu-size": "60px",
            "--map-ctrl-margin-right": isMobileDetected ? "0px" : "10px"
        }'
        data-bs-theme-base='neutral'
        data-bs-theme-primary='blue'
    >
        <div
            ref='map'
            style='width: 100%;'
        />

        <MapLoading
            v-if='loading || !mapStore.isMapLoaded'
            :stage='mapStore.loadingStage'
        />

        <template v-if='mapStore.isMapLoaded && !loading'>
            <!-- Scrim tinting the transparent native status bar inset to match
                 the top map controls - collapses to 0 height on web and is
                 omitted on iOS, where the status bar sits fully transparent
                 over the map -->
            <div
                v-if='!isIOSPlatform()'
                class='position-absolute top-0 start-0 end-0'
                style='
                    z-index: 5;
                    height: var(--status-bar-height, 0px);
                    background-color: rgba(0, 0, 0, 0.5);
                    pointer-events: none;
                '
            />

            <WarnConfiguration
                v-if='warnConfiguration'
                :page='warnConfiguration'
                @close='warnConfiguration = undefined'
            />
            <WarnChannels
                v-else-if='warnChannels'
                @close='warnChannels = false'
            />

            <DrawOverlay
                v-if='isDrawing'
            />

            <GenericBottomPane v-if='mode === "SetLocation"'>
                <div
                    class='card cloudtak-panel user-select-none'
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
            <GPSPanel
                :mode='mode'
                @set-location='setLocation'
                @to-location='toLocation'
            />
            <PluginPane v-if='mode === "Default" && !isDrawing' />
            <div
                v-if='mapStore.selected.size'
                class='position-absolute'
                style='
                    bottom: calc(var(--map-gps-panel-size, 84px) + 16px + var(--map-bottom-inset, 0px));
                    left: calc(8px + env(safe-area-inset-left, 0px));
                '
            >
                <SelectFeats :selected='mapStore.selected' />
            </div>

            <TopBar
                v-if='mode === "Default"'
                :menu-shown='!noMenuShown'
            />
            <div
                v-if='mapStore.navigation.active'
                class='position-absolute start-50 translate-middle-x'
                style='z-index: 2; top: var(--status-bar-height, 0px);'
            >
                <Navigating />
            </div>
            <div
                v-if='mode === "Default"'
                class='position-absolute'
                :class='{ "cloudtak-left-controls--nav": mapStore.navigation.active }'
                style='
                    top: calc(76px + var(--status-bar-height, 0px));
                    left: 8px;
                '
            >
                <div class='cloudtak-ctrl-group cloudtak-panel'>
                    <div
                        role='button'
                        tabindex='0'
                        title='Search Button'
                        class='cloudtak-ctrl-btn'
                        @click='searchBoxShown = !searchBoxShown'
                    >
                        <IconSearch
                            :size='24'
                            stroke='2'
                            :color='searchBoxShown ? "#1E90FF" : undefined'
                        />
                    </div>

                    <div
                        role='button'
                        tabindex='0'
                        class='cloudtak-ctrl-btn'
                        :title='mapStore.userOrientationMode ? "Orient North" : "Snap to North"'
                        @click='toggleCompass'
                    >
                        <IconCompass
                            v-if='mapStore.userOrientationMode'
                            :size='24'
                            stroke='2'
                            color='#1E90FF'
                        />
                        <template v-else>
                            <IconCircleArrowUp
                                :alt='`Map Rotated to ${humanBearing}`'
                                :transform='`rotate(${360 - mapStore.bearing})`'
                                :size='24'
                                stroke='2'
                            />
                            <div
                                v-if='mapStore.bearing !== 0'
                                class='text-center cloudtak-ctrl-label'
                                v-text='humanBearing'
                            />
                        </template>
                    </div>

                    <div
                        v-if='mapStore.pitch !== 0'
                        role='button'
                        tabindex='0'
                        class='cloudtak-ctrl-btn'
                        title='Snap Flat'
                        @click='mapStore.map.setPitch(0)'
                    >
                        <IconAngle
                            :alt='`Map Pitch to ${humanPitch}`'
                            :size='24'
                            stroke='2'
                        />
                        <div
                            class='text-center cloudtak-ctrl-label'
                            v-text='humanPitch'
                        />
                    </div>

                    <template v-if='displayZoom'>
                        <div
                            role='button'
                            tabindex='0'
                            title='Zoom In Button'
                            class='cloudtak-ctrl-btn'
                            @click='mapStore.map.setZoom(mapStore.map.getZoom() + 1);'
                        >
                            <IconPlus
                                :size='24'
                                stroke='2'
                            />
                        </div>
                        <div
                            role='button'
                            tabindex='0'
                            title='Zoom Out Button'
                            class='cloudtak-ctrl-btn'
                            @click='mapStore.map.setZoom(mapStore.map.getZoom() - 1);'
                        >
                            <IconMinus
                                :size='24'
                                stroke='2'
                            />
                        </div>
                    </template>

                    <div
                        v-if='hasTerrain'
                        role='button'
                        tabindex='0'
                        :title='mapStore.terrainEnabled ? "Disable 3D Terrain" : "Enable 3D Terrain"'
                        class='cloudtak-ctrl-btn'
                        @click='mapStore.toggleTerrain()'
                    >
                        <IconMountain
                            :size='24'
                            stroke='2'
                            :color='mapStore.terrainEnabled ? "#1E90FF" : undefined'
                        />
                    </div>

                    <div
                        v-if='
                            (mapStore.radial.cot && mapStore.locked.length >= 2)
                                || (!mapStore.radial.cot && mapStore.locked.length >= 1)
                        '
                        title='Map is locked to marker - Click to Unlock'
                        role='button'
                        tabindex='0'
                        class='cloudtak-ctrl-btn'
                        @click='mapStore.locked.splice(0, mapStore.locked.length)'
                    >
                        <IconLockAccess
                            color='red'
                            :size='24'
                            stroke='2'
                        />
                    </div>
                </div>
            </div>

            <TablerModal
                v-if='searchBoxShown'
                :dismissable='true'
                size='lg'
                @close='searchBoxShown = false'
            >
                <SearchBox
                    variant='panel'
                    placeholder='Search places, overlays, coordinates, or callsigns'
                    :autofocus='true'
                    :overlays='true'
                    @select='searchBoxShown = false'
                    @close='searchBoxShown = false'
                />
            </TablerModal>

            <MainMenu
                v-if='
                    mapStore.isMapLoaded
                        && (
                            (noMenuShown && !isMobileDetected)
                            || (!noMenuShown)
                        )
                '
                :compact='noMenuShown'
            />

            <div
                v-if='mapStore.isMapLoaded && isMobileDetected && mode === "Default"'
                class='position-absolute server-status-wrap'
                style='z-index: 4;'
            >
                <div class='d-flex flex-column align-items-end gap-2'>
                    <SharingPausedPill />
                    <ServerStatus :size='38' />
                </div>
            </div>

            <MultipleSelect
                v-if='mapStore.select.feats.length'
                @selected='selectFeat($event)'
            />

            <!-- Keyed on the radial target so repointing at a new feature remounts the component and regenerates its menu items -->
            <RadialMenu
                v-else-if='mapStore.radial.mode'
                :key='`${mapStore.radial.mode}:${mapStore.radial.cot?.properties?.id ?? ""}:${mapStore.radial.cot?.properties?.radialKey ?? ""}`'
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
                            method='PUT'
                            :cancel='false'
                            @cancel='upload.shown = false'
                            @done='fileUpload($event)'
                        />
                    </div>
                </TablerModal>
            </template>

            <MissionInviteModal
                v-if='inviteMission'
                :mission='inviteMission'
                @close='inviteMission = undefined'
            />
        </template>
    </div>
</template>

<script setup lang='ts'>
import GeoJSONInput from './Inputs/GeoJSONInput.vue';
import BufferInput from './Inputs/BufferInput.vue';
import { ref, watch, computed, toRaw, nextTick, onMounted, onBeforeUnmount, useTemplateRef } from 'vue';
import GPSPanel from './GPSPanel/GPSPanel.vue';
import PluginPane from './PluginPane.vue';
import {useRoute, useRouter } from 'vue-router';
import Navigating from './Navigating.vue';
import TopBar from './TopBar.vue';
import DrawOverlay from './util/DrawOverlay.vue';
import WarnChannels from './util/WarnChannels.vue';
import SearchBox from './util/SearchBox.vue';
import WarnConfiguration, { isPermissionsWarningDismissed } from './util/WarnConfiguration.vue';
import type { WarnConfigurationPage } from './util/WarnConfiguration.vue';
import GenericBottomPane from './GenericBottomPane.vue';
import type { MapGeoJSONFeature, LngLatLike, MapMouseEvent } from 'maplibre-gl';
import type { Feature } from '../../types.ts';
import {
    IconCircleArrowUp,
    IconLocationPin,
    IconLockAccess,
    IconLocation,
    IconMountain,
    IconCompass,
    IconSearch,
    IconMinus,
    IconAngle,
    IconPlus,
    IconX,
} from '@tabler/icons-vue';
import SelectFeats from './util/SelectFeats.vue';
import MultipleSelect from './util/MultipleSelect.vue';
import MainMenu from './MainMenu.vue';
import ServerStatus from './ServerStatus.vue';
import SharingPausedPill from './SharingPausedPill.vue';
import {
    TablerIconButton,
    TablerModal,
} from '@tak-ps/vue-tabler';
import { LocationState, WorkerMessageType } from '../../utils/events.ts';
import type { WorkerMessage } from '../../utils/events.ts';
import { v4 as randomUUID } from 'uuid';
import { lineString as turfLineString, point as turfPoint } from '@turf/helpers';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import lineSplit from '@turf/line-split';
import COT from '../../base/cot.ts';
import MapLoading from './MapLoading.vue';
import 'maplibre-gl/dist/maplibre-gl.css';
import RadialMenu from './RadialMenu/RadialMenu.vue';
import { zoomToTrail } from '../../base/trail.ts';
import { useMapStore } from '../../stores/map.ts';
import { useDeviceStore } from '../../stores/device.ts';
import { useAppStore } from '../../stores/app.ts';
import { DrawToolMode } from '../../stores/modules/draw.ts';
import { useFloatStore } from '../../stores/float.ts';
import Upload from '../util/Upload.vue';
import { stdurl } from '../../std.ts';
import ProfileConfig from '../../base/profile.ts';
import OverlayManager from '../../base/overlay.ts';
import { cutOverlayFeature } from './util/featureCut.ts';
import { isIOSPlatform, isNativePlatform, addAppLifecycleListeners } from '../../utils/capacitor.ts';
import { TimeoutError } from '../../utils/async.ts';
import { copyFeatureToClipboard, readFeatureFromClipboard } from '../../stores/device/clipboard.ts';
import MissionInviteModal from './Menu/Mission/MissionInviteModal.vue';

const mapStore = useMapStore();
const deviceStore = useDeviceStore();
const appStore = useAppStore();
const floatStore = useFloatStore();

const hasTerrain = computed(() => OverlayManager.loaded.some((overlay) => overlay.type === 'raster-dem'));
const router = useRouter();
const route = useRoute();

const emit = defineEmits(['err']);

const mode = ref<string>('Default');
const locationClickHandler = ref<((e: MapMouseEvent) => void) | null>(null);
const height = ref<number>(window.innerHeight);
const width = ref<number>(window.innerWidth);

appStore.isMobileDetected = detectMobile();

const warnChannels = ref<boolean>(false)

const warnConfiguration = ref<WarnConfigurationPage | undefined>();

const searchBoxShown = ref(false);

const upload = ref({
    shown: false,
    dragging: false
})

const bufferCotId = ref<string | null>(null)

const inviteMission = ref<{
    name: string;
    guid: string;
    token: string;
    authorUid: string;
    tool: string;
    type: string;
} | undefined>();

let inviteChannel: BroadcastChannel | undefined;

const loading = ref(true)

// A boot suspended by a background transition can wedge - reload on resume
let bootComplete = false;
let bootInterrupted = false;
let unmounted = false;
let removeAppLifecycleListeners: (() => void) | undefined;
let ctrlStackObserver: ResizeObserver | undefined;

// A boot stage that times out on native is reloaded rather than retried in
// place - terminating a worker mid-open can wedge the next attempt. Once per
// page session, so a second timeout falls through to the error and Hard Reset.
const BOOT_TIMEOUT_RELOAD_KEY = 'cloudtak::boot-timeout-reloaded';

function reloadOnceForBootTimeout(): boolean {
    try {
        if (sessionStorage.getItem(BOOT_TIMEOUT_RELOAD_KEY)) return false;
        sessionStorage.setItem(BOOT_TIMEOUT_RELOAD_KEY, '1');
    } catch {
        return false;
    }

    location.reload();
    return true;
}

// A stage that hung, or the worker's storage probe giving up, both mean
// IndexedDB is not answering. The probe's error arrives through Comlink,
// which keeps the name but not the class.
function isStorageStall(err: Error): boolean {
    return err instanceof TimeoutError || err.name === 'DatabaseUnavailableError';
}

function clearBootTimeoutReloadGuard(): void {
    try {
        sessionStorage.removeItem(BOOT_TIMEOUT_RELOAD_KEY);
    } catch {
        // storage unavailable - the guard was never set either
    }
}

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

const isDrawing = computed(() => {
    return mapStore.draw.mode !== DrawToolMode.STATIC;
});

watch(isMobileDetected, () => {
    appStore.isMobileDetected = isMobileDetected.value;
});

watch(() => mapStore.toImport.length, async (length) => {
    if (!length) return;

    const features = toRaw(mapStore.toImport).slice();
    mapStore.toImport = [];

    // Delete first so a pane already open from the Draw Tools remounts with the dropped features
    const uid = 'geojson-import';
    floatStore.delete(uid);
    await nextTick();

    floatStore.add({
        uid,
        name: 'GeoJSON Import',
        component: GeoJSONInput,
        config: { features },
        height: 500,
        width: 500,
        corner: 'top-right',
    });
});

watch(() => appStore.resolvedTheme, (theme) => {
    if (!mapStore._map || !mapStore.isMapLoaded) return;
    mapStore.map.setGlobalStateProperty('theme', theme);
});

const displayZoom = computed(() => {
    if (mapStore.zoom === 'conditional') {
        return !isMobileDetected.value;
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
        mapStore.userOrientationMode = true;
    }
}

const mapRef = useTemplateRef<HTMLElement>('map');

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

    if (isNativePlatform()) {
        removeAppLifecycleListeners = await addAppLifecycleListeners({
            pause: () => {
                // A new background gets its own reload attempt
                clearBootTimeoutReloadGuard();

                if (!bootComplete) {
                    bootInterrupted = true;
                    return;
                }

                // Storage must be idle while backgrounded - see mapStore.suspend()
                void mapStore.suspend();
            },
            resume: () => {
                if (bootInterrupted) {
                    location.reload();
                    return;
                }

                if (bootComplete) void mapStore.resume();
            }
        });
    }

    let bootError: Error | undefined;
    // init() returns false when this mount was superseded by a teardown before it
    // could finish - a newer Map.vue instance owns the store at that point. That
    // is not an error and must not be retried.
    let started = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            started = await mapStore.init(mapRef.value);
            bootError = undefined;
            break;
        } catch (err) {
            bootError = err instanceof Error ? err : new Error(String(err));
            console.error(`Map boot attempt ${attempt} failed:`, err);

            if (attempt === 3) break;
            if (unmounted) return;

            // Native never retries a stalled stage in place: destroy would
            // terminate a worker mid-open, and its teardown is unbounded.
            // Reload once per background, otherwise surface the error.
            if (isNativePlatform() && isStorageStall(bootError)) {
                if (reloadOnceForBootTimeout()) return;
                break;
            }

            // A failed teardown must not replace the boot error that got us
            // here - it would escape onMounted and reach App.vue's error dialog
            try {
                await mapStore.destroy();
            } catch (destroyErr) {
                console.error('Failed to tear down map state before retrying boot:', destroyErr);
            }
            mapStore.loadingStage = 'Load failed - retrying…';
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
    }

    bootComplete = true;

    if (bootError) {
        emit('err', bootError);
        return;
    }

    // Superseded mid-boot: none of the wiring below applies, and touching
    // mapStore.map would throw. A newer mount owns the boot-timeout guard and
    // clears it when it completes, so leave it for that mount.
    if (!started) return;

    clearBootTimeoutReloadGuard();

    // The Return Home button sits just above the MapLibre bottom-right
    // control stack (scale + attribution) and needs to track its live
    // height, since the attribution box's expanded/collapsed state changes
    // it - see .server-status-wrap in <style> below. MapLibre creates
    // .maplibregl-ctrl-bottom-right as a child of the map container itself
    // (mapRef.value), not of .map-shell, which is why the lookup and the
    // CSS variable target different elements.
    const ctrlBottomRightEl = mapRef.value?.querySelector('.maplibregl-ctrl-bottom-right');
    const shellEl = mapRef.value?.parentElement as HTMLElement | undefined;
    if (ctrlBottomRightEl && shellEl) {
        ctrlStackObserver = new ResizeObserver(() => {
            shellEl.style.setProperty('--map-ctrl-stack-height', `${ctrlBottomRightEl.getBoundingClientRect().height}px`);
        });
        ctrlStackObserver.observe(ctrlBottomRightEl);
    }

    // TODO these are no longer reactive, does it matter?
    warnChannels.value = await mapStore.worker.profile.hasNoChannels();
    if (await mapStore.worker.profile.hasNoConfiguration()) {
        warnConfiguration.value = 'details';
    } else if (!deviceStore.hasRequiredPermissions() && !isPermissionsWarningDismissed()) {
        warnConfiguration.value = 'permissions';
    }

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

    inviteChannel = new BroadcastChannel('cloudtak');
    inviteChannel.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const msg = event.data;
        if (msg && msg.type === WorkerMessageType.Mission_Invite) {
            inviteMission.value = msg.body;
        }
    };
});

onBeforeUnmount(() => {
    unmounted = true;
    bootComplete = true;
    removeAppLifecycleListeners?.();
    ctrlStackObserver?.disconnect();
    inviteChannel?.close();
    // Lifecycle hooks are synchronous, so this teardown cannot be awaited here.
    // mapStore.init() waits on it instead, which is what keeps a remount from
    // racing it. The catch matters because that shared promise now has two
    // consumers - without it a failed teardown surfaces as an unhandled
    // rejection and App.vue pops an error modal on the way out.
    void mapStore.destroy().catch((err: unknown) => {
        console.error('Failed to tear down map state:', err);
    });
});

function selectFeat(selectedFeat: MapGeoJSONFeature | COT) {
    if (selectedFeat instanceof COT) {
        // Mirror a direct marker click - open the radial menu for the CoT rather than the CoTView sidebar
        const lngLat = mapStore.map.unproject([mapStore.select.x, mapStore.select.y]);

        mapStore.select.feats = [];

        void mapStore.radialClick(selectedFeat.as_feature(), {
            lngLat,
            point: mapStore.map.project(lngLat),
            mode: 'cot'
        }).catch((err) => {
            console.error('Failed to open radial menu for selected CoT', err);
        });
    } else {
        mapStore.select.feats = [];
        mapStore.viewedFeature = selectedFeat;
        router.push(`/menu/feature`);
    }
}

function closeRadial() {
    mapStore.radial.mode = undefined;
    mapStore.radial.cot = undefined;
}

async function toLocation() {
    const location = await mapStore.worker.profile.location;

    if ([LocationState.Preset, LocationState.Live].includes(location.source)) {
        mapStore.map.jumpTo({
            center: location.coordinates as LngLatLike,
            zoom: 14
        });
    } else {
        throw new Error('No Location Set or Location could not be retrieved');
    }
}

function setLocation() {
    mapStore.manualLocationMode = true;
    mode.value = 'SetLocation';
    mapStore.map.getCanvas().style.cursor = 'crosshair';

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
    mapStore.manualLocationMode = false;
    mode.value = 'Default';
    mapStore.map.getCanvas().style.cursor = '';

    if (locationClickHandler.value) {
        mapStore.map.off('click', locationClickHandler.value);
        locationClickHandler.value = null;
    }
}

async function exitManualMode() {
    mapStore.manualLocationMode = false;
    mode.value = 'Default';
    mapStore.map.getCanvas().style.cursor = '';

    if (locationClickHandler.value) {
        mapStore.map.off('click', locationClickHandler.value);
        locationClickHandler.value = null;
    }

    mapStore.location = LocationState.Loading;

    // Remove current location dot from map by removing user's CoT
    const username = await ProfileConfig.get('username');
    const userUid = `ANDROID-CloudTAK-${username ? username.value : 'unknown'}`;
    await mapStore.worker.db.remove(userUid);

    await mapStore.worker.profile.update({ tak_loc: null });

    void mapStore.startLocationWatch();

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
    } else if (event.startsWith('trail:')) {
        // The radial of a breadcrumb trail carries the UID of the CoT it belongs to
        const uid = String(mapStore.radial.cot.properties.id);
        const historyId = (mapStore.radial.cot.properties as Record<string, unknown>).historyId;
        closeRadial()
        if (event === 'trail:view') {
            await router.push(`/cot/${encodeURIComponent(uid)}`);
        } else if (event === 'trail:point' && historyId) {
            await mapStore.history.open(String(historyId));
        } else if (event === 'trail:zoom') {
            await zoomToTrail(mapStore.map, uid);
        } else if (event === 'trail:history') {
            await router.push({ path: '/menu/history', query: { uid } });
        } else if (event === 'trail:clear') {
            await mapStore.worker.db.breadcrumb.remove(uid);
        }
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
            authored: true,
            // Fresh id from the contextmenu - it cannot already be in a Mission
            skipMissionLookup: true
        });

        await mapStore.refresh();
        closeRadial()
    } else if (event === 'cot:copy') {
        const cotFeat = await mapStore.worker.db.get(
            mapStore.radial.cot.properties.id || String(mapStore.radial.cot.id),
            { mission: true }
        );

        closeRadial();
        if (!cotFeat) throw new Error('Cannot find COT to copy');

        await copyFeatureToClipboard({
            id: cotFeat.id,
            type: 'Feature',
            path: cotFeat.path || '/',
            properties: cotFeat.properties,
            geometry: cotFeat.geometry
        } as Feature);
    } else if (event === 'context:paste') {
        const lngLat = mapStore.radial.lngLat;
        closeRadial();

        if (!lngLat) throw new Error('Cannot determine paste location');

        const feat = await readFeatureFromClipboard();
        if (!feat) throw new Error('Clipboard does not contain a GeoJSON Point Feature');

        const id = randomUUID();
        feat.id = id;
        feat.properties.id = id;

        feat.geometry = {
            type: 'Point',
            coordinates: [lngLat.lng, lngLat.lat]
        };
        feat.properties.center = [lngLat.lng, lngLat.lat];

        // Pasted features are authored copies - archive so they survive going stale
        feat.properties.archived = true;

        await mapStore.worker.db.add(feat, {
            authored: true,
            // Fresh id - it cannot already be in a Mission
            skipMissionLookup: true
        });

        await mapStore.refresh();
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
/*
 * Drops the left controls below the navigation banner once it wraps to its own
 * row on small screens - `.cloudtak-navigating` itself is styled in style.scss
 * because it is rendered by `Navigating.vue`.
 */
@media (max-width: 767.98px) {
    .cloudtak-left-controls--nav {
        top: calc(134px + var(--status-bar-height, 0px)) !important;
    }
}

.cloudtak-ctrl-group {
    display: flex;
    flex-direction: column;
    width: 40px;
    overflow: hidden;
}

.cloudtak-ctrl-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 7px 0;
    cursor: pointer;
    color: inherit;
    transition: background-color 0.15s ease;
}

.cloudtak-ctrl-btn:focus-visible {
    outline: none;
}

.cloudtak-ctrl-btn:not(:first-child) {
    border-top: 1px solid var(--tblr-border-color);
}

html[data-bs-theme='dark'] .cloudtak-ctrl-btn:hover,
html[data-bs-theme='dark'] .cloudtak-ctrl-btn:focus-visible,
html[data-bs-theme='dark'] .cloudtak-ctrl-btn:focus-within {
    background-color: rgba(255, 255, 255, 0.12);
}

html[data-bs-theme='light'] .cloudtak-ctrl-btn:hover,
html[data-bs-theme='light'] .cloudtak-ctrl-btn:focus-visible,
html[data-bs-theme='light'] .cloudtak-ctrl-btn:focus-within {
    background-color: rgba(0, 0, 0, 0.06);
}

.cloudtak-ctrl-label {
    font-size: 11px;
    line-height: 1;
    margin-top: 2px;
}

/*
 * Patch 001 deliberately does NOT re-add upstream's `.maplibregl-ctrl-scale::before`
 * transparent white-on-black scale-bar styling - we keep MapLibre's default
 * box, an opaque background with dark text. The `.map-shell` GPS-panel CSS
 * variables below are load-bearing (the bottom-control rules reference
 * --map-gps-panel-size / --map-bottom-inset).
 */
.map-shell {
    --map-gps-panel-size: 84px;
    --map-bottom-inset: env(safe-area-inset-bottom, 0px);
    /*
     * The GPS/callsign panel's right edge (its own left inset + responsive
     * width, mirroring GPSPanel.vue's `left`/`width`/`max-width` formulas so
     * the two can't drift apart) - used below to cap the attribution/scale
     * stack's width so expanded attribution text can never stretch over it.
     */
    --map-gps-panel-right: min(228px + env(safe-area-inset-left, 0px), 100vw - 8px - env(safe-area-inset-right, 0px));
    /*
     * Extra breathing room between the GPS panel's right edge and the
     * attribution/scale stack's left edge, on top of the 8px each already
     * keeps from its own side of the viewport. Desktop has enough natural
     * gap without this; mobile doesn't, so it's zero here and set below.
     */
    --map-attrib-gps-gap: 0px;
}

@media (max-width: 600px) {
    .map-shell {
        --map-gps-panel-right: min(228px + env(safe-area-inset-left, 0px), 100vw - 62px - env(safe-area-inset-right, 0px));
        /* Half of the 8px inset each box keeps from its own side of the viewport. */
        --map-attrib-gps-gap: 4px;
    }
}

.maplibregl-ctrl-bottom-left {
    bottom: calc(var(--map-gps-panel-size, 84px) + 12px + var(--map-bottom-inset, 0px));
    left: calc(8px + env(safe-area-inset-left, 0px));
    right: auto;
    margin: 0;
    z-index: 3 !important;
    pointer-events: none;
}

/*
 * Bottom/right inset matches the GPS panel's own bottom/left inset (8px) for
 * visual symmetry.
 */
.maplibregl-ctrl-bottom-right {
    bottom: calc(8px + var(--map-bottom-inset, 0px));
    right: calc(var(--map-side-offset, 0px) + 8px + env(safe-area-inset-right, 0px));
    left: auto;
    z-index: 3 !important;
    color: black !important;
    /* Caps the box so expanded attribution text can't stretch left over the
       GPS/callsign panel, leaving --map-attrib-gps-gap of clear space
       between the two when the box is at its widest. */
    max-width: calc(100vw - var(--map-gps-panel-right) - 8px - var(--map-side-offset, 0px) - var(--map-attrib-gps-gap, 0px) - env(safe-area-inset-right, 0px));
}

/*
 * Both scale and attribution get the same 8px rhythm between/below them,
 * with the container's own 8px bottom inset (above) providing the only gap
 * below the last one - MapLibre's own bottom-right margin
 * (`0 10px 10px 0`) has equal-or-greater specificity than a bare
 * `.maplibregl-ctrl-scale` override, so it must be overridden via the same
 * compound selector it uses, or the scale bar keeps a stray 10px gap under
 * it regardless of what `.maplibregl-ctrl-scale` alone says.
 *
 * The right margin (--map-ctrl-margin-right, set alongside --map-side-offset
 * below) is 10px on desktop - the only breathing room between the controls
 * and the menu sidebar (MainMenu.vue), which floats at its own `right: 8px`
 * independent of this container's own inset - and 0 on mobile, where there
 * is no sidebar and the container's own `right: 8px` (above) must be the
 * *entire* gap to the viewport edge, matching the GPS panel's own 8px on
 * the left. This has to key off the same isMobileDetected JS condition as
 * --map-side-offset, not a width media query: isMobileDetected trips on
 * width OR height (e.g. a short landscape phone), and a width-only
 * breakpoint disagreeing with that is exactly what caused the Return Home
 * button to float over this stack before it was anchored the same way.
 */
.maplibregl-ctrl-bottom-right .maplibregl-ctrl {
    margin: 0 var(--map-ctrl-margin-right, 10px) 8px 0;
}

.maplibregl-ctrl-bottom-right .maplibregl-ctrl:last-child {
    margin-bottom: 0;
}

.maplibregl-ctrl-attrib a {
    color: black !important;
}

/* Attribution has no font-size of its own, so it inherits the map's base
   12px - 2px larger than the scale bar's own explicit 10px. Match them. */
.maplibregl-ctrl-attrib {
    font-size: 10px;
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
        left: calc(4px + env(safe-area-inset-left, 0px));
    }
}

/*
 * Return Home button (below, in the template). Only rendered while
 * appStore.isMobileDetected, which trips on either narrow WIDTH or short
 * HEIGHT - e.g. a phone in landscape is wide but short. Deliberately NOT
 * gated behind a width media query here: a width-only breakpoint
 * disagreeing with that width-or-height condition is exactly how this
 * button ended up floating over the attribution/scale stack in landscape,
 * where width alone never crosses a mobile breakpoint. Since the element
 * only exists in the DOM when isMobileDetected is already true, this rule
 * needs no matching width condition of its own.
 *
 * Anchored above the bottom-right MapLibre control stack via
 * --map-ctrl-stack-height, kept in sync with its live height by a
 * ResizeObserver (see onMounted below), so it rides up when attribution
 * expands and back down when it collapses. +8px for the stack's own bottom
 * inset (matches .maplibregl-ctrl-bottom-right's `bottom` above) and +8px
 * gap above it - the same 8px rhythm used everywhere else.
 */
.server-status-wrap {
    bottom: calc(8px + var(--map-ctrl-stack-height, 76px) + 8px + var(--map-bottom-inset, 0px)) !important;
    right: calc(8px + env(safe-area-inset-right, 0px)) !important;
    transition: bottom 0.15s ease;
}
</style>
