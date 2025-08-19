<template>
    <div
        class='d-flex position-relative'
        style='height: calc(100vh) !important;'
        data-bs-theme='dark'
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
            <div
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
                    <div
                        class='hover-button h-100 d-flex align-items-center'
                        style='width: 40px;'
                    >
                        <TablerIconButton
                            v-if='
                                (mapStore.radial.cot && mapStore.locked.length >= 2)
                                    || (!mapStore.radial.cot && mapStore.locked.length >= 1)
                            '
                            title='Map is locked to marker - Click to Unlock'
                            @click='mapStore.locked.splice(0, mapStore.locked.length)'
                        >
                            <IconLockAccess
                                color='#83b7e8'
                                :size='20'
                                stroke='1'
                                style='margin: 5px 8px'
                            />
                        </TablerIconButton>
                        <IconLocation
                            v-else-if='mapStore.location === LocationState.Live'
                            title='Live Location'
                            style='margin: 5px 8px'
                            :size='20'
                            stroke='1'
                        />
                        <TablerIconButton
                            v-else-if='mapStore.location === LocationState.Preset'
                            title='Update Your Location Button'
                            @click='setLocation'
                        >
                            <IconLocationPin
                                title='Preset Location'
                                style='margin: 5px 8px'
                                :size='20'
                                stroke='1'
                            />
                        </TablerIconButton>
                        <TablerIconButton
                            v-else
                            title='Set Your Location Button'
                            @click='setLocation'
                        >
                            <IconLocationOff
                                title='Set Your Location Button (No Location currently set)'
                                style='margin: 5px 8px'
                                :size='20'
                                stroke='1'
                            />
                        </TablerIconButton>
                    </div>
                    <div
                        v-tooltip='"Zoom To Location"'
                        style='line-height: 40px; width: calc(100% - 40px);'
                        class='h-100 cursor-pointer text-center px-2 text-truncate subheader text-white hover-button user-select-none'
                        @click='toLocation'
                        v-text='mapStore.callsign'
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
                        height: 40px;
                        max-width: 400px;
                        background-color: rgba(0, 0, 0, 0.5);
                        border-radius: 0px 0px 6px 0px;
                    '
                >
                    <template v-if='!mapStore.mission'>
                        <div
                            class='hover-button d-flex align-items-center user-select-none cursor-pointer'
                            @click='router.push("/menu/missions")'
                        >
                            <IconMap
                                :size='32'
                                stroke='1'
                                style='margin: 3px 3px'
                            />
                            <div class='me-3'>
                                No Mission
                            </div>
                        </div>
                    </template>
                    <template v-else>
                        <div class='d-flex align-items-center user-select-none'>
                            <IconAmbulance
                                :size='32'
                                stroke='1'
                                style='margin: 3px 3px'
                            />

                            <a
                                class='me-3 text-truncate cursor-pointer text-white'
                                @click='router.push(`/menu/missions/${mapStore.mission.meta.guid}`)'
                                v-text='mapStore.mission.meta.name'
                            />
                        </div>
                    </template>
                </div>
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
                            class='cursor-pointer hover-button'
                            @click='searchBoxShown = !searchBoxShown'
                        />
                    </div>

                    <div
                        v-if='mapStore.bearing !== 0'
                        style='margin: 3px 3px'
                        class='cursor-pointer hover-button'
                        @click='mapStore.map.setBearing(0)'
                    >
                        <IconCircleArrowUp
                            v-tooltip='"Snap to North"'
                            tabindex='0'
                            :alt='`Map Rotated to ${humanBearing}`'
                            :transform='`rotate(${360 - mapStore.bearing})`'
                            :size='32'
                            stroke='2'
                        />
                        <div
                            v-if='mapStore.bearing !== 0'
                            class='text-center'
                            v-text='humanBearing'
                        />
                    </div>
                    <div
                        v-if='mapStore.pitch !== 0'
                        style='margin: 3px 3px'
                        class='cursor-pointer hover-button'
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
                            class='cursor-pointer hover-button'
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
                            class='cursor-pointer hover-button'
                            style='margin: 3px 3px'
                            @click='mapStore.map.setZoom(mapStore.map.getZoom() - 1);'
                        />
                    </div>

                    <Icon3dCubeSphere
                        v-tooltip='mapStore.isTerrainEnabled ? "Disable 3D Terrain" : "Enable 3D Terrain"'
                        role='button'
                        tabindex='0'
                        title='3D Terrain'
                        :size='32'
                        stroke='2'
                        class='cursor-pointer hover-button'
                        :color='mapStore.isTerrainEnabled ? "#1E90FF" : "#FFFFFF"'
                        style='margin: 3px 3px'
                        @click='mapStore.isTerrainEnabled ? mapStore.removeTerrain() : mapStore.addTerrain()'
                    />
                </div>
            </div>

            <SearchBox
                v-if='searchBoxShown'
                class='position-absolute'
                style='
                    z-index: 1;
                    top: 40px;
                    left: 40px;
                    width: 300px;
                '
                :autofocus='true'
                @select='searchBoxShown = false'
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
                    <TablerIconButton
                        id='map-notifications'
                        title='Notifications Icon'
                    >
                        <IconBell
                            :size='40'
                            stroke='1'
                        />
                    </TablerIconButton>
                    <template #dropdown>
                        <Notifications />
                    </template>
                </TablerDropdown>

                <span
                    v-if='mapStore.notifications.length'
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
                @close='closeRadial'
                @click='handleRadial($event)'
            />

            <CloudTAKFeatView
                v-if='feat && mode === "Default" && route.name === "home"'
                :key='feat.id'
                :feat='feat'
            />

            <template
                v-for='float in floatStore.panes.values()'
                :key='float.uid'
            >
                <FloatingVideo
                    v-if='float.type === PaneType.VIDEO'
                    :uid='float.uid'
                    @close='floatStore.panes.delete(float.uid)'
                />
                <FloatingAttachment
                    v-if='float.type === PaneType.ATTACHMENT'
                    :uid='float.uid'
                    @close='floatStore.panes.delete(float.uid)'
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
import { ref, watch, computed, toRaw, onMounted, onBeforeUnmount, useTemplateRef } from 'vue';
import {useRoute, useRouter } from 'vue-router';
import FloatingVideo from './util/FloatingVideo.vue';
import FloatingAttachment from './util/FloatingAttachment.vue';
import DrawOverlay from './util/DrawOverlay.vue';
import WarnChannels from './util/WarnChannels.vue';
import Notifications from './Notifications.vue';
import SearchBox from './util/SearchBox.vue';
import WarnConfiguration from './util/WarnConfiguration.vue';
import DrawTools from './DrawTools.vue';
import type { MapGeoJSONFeature, LngLatLike } from 'maplibre-gl';
import type { Feature } from '../../types.ts';
import CloudTAKFeatView from './FeatView.vue';
import {
    IconSearch,
    IconLocationOff,
    IconLocationPin,
    IconLocation,
    IconMenu2,
    IconPlus,
    IconMinus,
    IconLockAccess,
    IconAmbulance,
    IconMap,
    IconX,
    IconBell,
    IconAngle,
    IconCircleArrowUp,
    Icon3dCubeSphere,
} from '@tabler/icons-vue';
import SelectFeats from './util/SelectFeats.vue';
import MultipleSelect from './util/MultipleSelect.vue';
import SideMenu from './MainMenu.vue';
import {
    TablerIconButton,
    TablerDropdown,
    TablerModal,
} from '@tak-ps/vue-tabler';
import { LocationState } from '../../base/events.ts';
import MapLoading from './MapLoading.vue';
import 'maplibre-gl/dist/maplibre-gl.css';
import RadialMenu from './RadialMenu/RadialMenu.vue';
import { useMapStore } from '../../stores/map.ts';
import { DrawToolMode } from '../../stores/modules/draw.ts';
import { useFloatStore, PaneType } from '../../stores/float.ts';
import UploadImport from './util/UploadImport.vue'
const mapStore = useMapStore();
const floatStore = useFloatStore();
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
const feat = ref()        // Show the Feat Viewer sidebar

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

const displayZoom = computed(() => {
    if (mapStore.zoom === 'conditional') {
        return mobileDetected;
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

const mapRef = useTemplateRef<HTMLElement>('map');

const noMenuShown = computed<boolean>(() => {
    return !feat.value
        && (!route.name || !String(route.name).startsWith('home-menu'))
});

watch(mapStore.radial, () => {
    if (mapStore.radial.cot) {
        mapStore.map.scrollZoom.disable();
        mapStore.map.touchZoomRotate.disableRotation();
        mapStore.map.dragRotate.disable();
        mapStore.map.dragPan.disable();

        const id = mapStore.radial.cot.properties ? mapStore.radial.cot.properties.id : mapStore.radial.cot.id;
        if (!mapStore.locked.includes(id)) {
            mapStore.locked.push(mapStore.radial.cot.properties ? mapStore.radial.cot.properties.id : mapStore.radial.cot.id);
        }
    } else {
        mapStore.map.scrollZoom.enable();
        mapStore.map.touchZoomRotate.enableRotation();
        mapStore.map.dragRotate.enable();
        mapStore.map.dragPan.enable();
        mapStore.locked.pop();
    }
})

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

    await mountMap();

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

        await mapStore.refresh();
    });
}

function fileUpload(event: string) {
    upload.value.shown = false;
    const imp = JSON.parse(event) as { id: string };
    router.push(`/menu/imports/${imp.id}`)
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

        if (route.name === 'home-menu-cot' && route.params.uid === cot.id) {
            router.push('/');
        }

        await mapStore.worker.db.remove(String(cot.id || cot.properties.id), {
            mission: true
        })

        await mapStore.refresh();
    } else if (event === 'cot:lock') {
        mapStore.locked.push(mapStore.radial.cot.properties ? mapStore.radial.cot.properties.id : mapStore.radial.cot.id);
        closeRadial()
    } else if (event === 'cot:edit') {
        const cot = await mapStore.worker.db.get(String(mapStore.radial.cot.id ? mapStore.radial.cot.id : mapStore.radial.cot.properties.id))
        if (!cot) throw new Error('Cannot Find COT Marker');
        await mapStore.draw.edit(cot);

        closeRadial()
    } else if (event === 'feat:view') {
        selectFeat(mapStore.radial.cot as MapGeoJSONFeature);
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
    } else {
        closeRadial()
        throw new Error(`Unimplemented Radial Action: ${event}`);
    }
}

async function mountMap(): Promise<void> {
    if (!mapRef.value) throw new Error('Map Element could not be found - Please refresh the page and try again');
    await mapStore.init(mapRef.value);

    return new Promise((resolve) => {
        mapStore.map.once('idle', async () => {
            const profile = await mapStore.worker.profile.load();

            if (profile.display_projection === 'globe') {
                mapStore.map.setProjection({ type: "globe" });
            }

            await mapStore.worker.db.updateImages(mapStore.map.listImages());

            await mapStore.initOverlays();

            timer.value = setInterval(async () => {
                if (!mapStore.map) return;
                await mapStore.refresh();
            }, 500);

            return resolve();
        });
    });
}
</script>

<style>
.maplibregl-ctrl-bottom-left {
    bottom: 0;
    left: 260px;
}

.maplibregl-ctrl-bottom-right {
    bottom: 0;
    right: 60px;
    z-index: 1 !important;
    color: black !important;
}

.maplibregl-ctrl-attrib a {
    color: black !important;
}
</style>
