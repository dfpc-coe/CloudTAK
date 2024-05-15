<template>
<Loading v-if='loading.main'/>
<div v-else data-bs-theme="dark" class="d-flex position-relative" style='height: calc(100vh) !important;'>
    <div
        v-if='mode === "Default"'
        class='position-absolute top-0 end-0 text-white py-2'
        style='z-index: 1; width: 60px; background-color: rgba(0, 0, 0, 0.5);'
   >
        <IconMenu2
            v-if='noMenuShown'
            @click='$router.push("/menu")'
            size='40'
            class='mx-2 cursor-pointer hover-button'
        />
        <IconX
            v-else
            @click='closeAllMenu'
            size='40'
            class='mx-2 cursor-pointer bg-dark'
        />
    </div>

    <div
        v-if='profile'
        class='position-absolute bottom-0 begin-0 text-white'
        style='
            z-index: 1;
            width: 200px;
            height: 40px;
            border-radius: 0px 6px 0px 0px;
            background-color: rgba(0, 0, 0, 0.5);
        '
    >
        <div class='d-flex align-items-center h-100'>
            <div
                class='hover-button h-100 px-2 d-flex align-items-center cursor-pointer'
                style='width: 40px;'
                v-tooltip='"Set Location"'
            >
                <IconLocationOff size='20' @click='setLocation' v-if='!profile.tak_loc'/>
                <IconLocation size='20' @click='setLocation' v-else/>
            </div>
            <div
                v-text='profile.tak_callsign'
                @click='toLocation'
                style='line-height: 40px; width: calc(100% - 40px);'
                class='h-100 cursor-pointer text-center px-2 text-truncate subheader text-white hover-button'
                v-tooltip='"Zoom To Location"'
            ></div>
        </div>
    </div>
    <div
        v-if='selected.size'
        class='position-absolute begin-0 text-white bg-dark'
        style='
            z-index: 1;
            bottom: 40px;
            width: 200px;
        '
    >
        <SelectFeats :selected='selected'/>
    </div>

    <div
        v-if='mode === "Default"'
        class='position-absolute top-0 beginning-0 text-white py-2 px-2'
        style='
            z-index: 1;
            width: 60px;
            background-color: rgba(0, 0, 0, 0.5);
            border-radius: 0px 0px 6px 0px;
        '>

        <IconSearch v-if='false' size='40' class='cursor-pointer hover-button mb-3' v-tooltip='"Search"'/>

        <div @click='setBearing(0)' style='margin-bottom: 10px;' class='cursor-pointer hover-button'>
            <IconCircleArrowUp :transform='`rotate(${360 - bearing})`' size='40' v-tooltip='"Snap to North"'/>
            <div v-if='bearing !== 0' class='text-center' v-text='humanBearing'></div>
        </div>
        <IconFocus2 v-if='!radial.cot && !locked.length' @click='getLocation' size='40' class='cursor-pointer hover-button' v-tooltip='"Get Location"'/>
        <IconLockAccess v-else-if='!radial.cot' @click='locked.splice(0, locked.length)' size='40' class='cursor-pointer hover-button'/>

        <div class='mt-3'>
            <IconPlus size='40' @click='setZoom(getZoom() + 1);' class='cursor-pointer hover-button' v-tooltip='"Zoom In"'/>
            <IconMinus size='40' @click='setZoom(getZoom() - 1);' class='cursor-pointer hover-button' v-tooltip='"Zoom Out"'/>
        </div>
    </div>

    <div v-if='isLoaded && mode === "Default"'
        class='d-flex position-absolute top-0 text-white py-2'
        style='
            z-index: 1;
            width: 120px;
            right: 60px;
            background-color: rgba(0, 0, 0, 0.5);
            border-radius: 0px 0px 0px 6px;
        '
    >
        <TablerDropdown>
            <template #default>
                <div class='mx-2 cursor-pointer'>
                    <IconBell size='40' class='hover-button'/>
                    <span v-if='notifications.length' class="badge bg-red mb-2"></span>
                    <span v-else style='width: 10px;'/>
                </div>
            </template>
            <template #dropdown>
                <TablerNone v-if='!notifications.length' label='New Notifications' :create='false'/>
                <template v-else>
                    <div class='col-12 d-flex py-2 px-2'>
                        <div @click='clearNotifications' class='ms-auto cursor-pointer'>Clear All</div>
                    </div>
                    <div class='col-12 px-2 py-2' v-for='n of notifications'>
                        <div @click='$router.push(n.url)' v-if='n.type === "Chat"' class='col-12 cursor-pointer hover-dark'>
                            <IconMessage size='32'/>
                            <span v-text='n.name'/>
                        </div>
                    </div>
                </template>
            </template>
        </TablerDropdown>
        <TablerDropdown>
            <template #default>
                <IconPencil @click='closeAllMenu' size='40' class='mx-2 cursor-pointer hover-button'/>
            </template>
            <template #dropdown>
                <div @click='pointInput.shown = true' class='col-12 py-1 px-2 hover-button cursor-pointer'>
                    <IconCursorText size='25'/> Coordinate Input
                </div>
                <div @click='startDraw("point")' class='col-12 py-1 px-2 hover-button cursor-pointer'>
                    <IconPoint size='25'/> Draw Point
                </div>
                <div @click='startDraw("linestring")' class='col-12 py-1 px-2 hover-button cursor-pointer'>
                    <IconLine size='25'/> Draw Line
                </div>
                <div @click='startDraw("polygon")' class='col-12 py-1 px-2 hover-button cursor-pointer'>
                    <IconPolygon size='25'/> Draw Polygon
                </div>
                <div @click='startDraw("rectangle")' class='col-12 py-1 px-2 hover-button cursor-pointer'>
                    <IconVector size='25'/> Draw Rectangle
                </div>
            </template>
        </TablerDropdown>
    </div>

    <router-view @reset='deleteCOT()'/>

    <div
        v-if='pointInput.shown'
        class='position-absolute end-0 text-white bg-dark'
        style='
            top: 56px;
            z-index: 1;
            width: 300px;
            border-radius: 0px 6px 0px 0px;
        '
    >
        <div class='mx-2 my-2'>
            <TablerInput label='Name' v-model='pointInput.name' @submit='submitPoint'/>
            <Coordinate v-model='pointInput.coordinates' :edit='true' :modes='["dd"]' @submit='submitPoint'/>
            <button @click='submitPoint' class='btn btn-primary w-100 mt-3'>Save</button>
        </div>
    </div>

    <div ref="map" style='width: 100%;'></div>

    <MultipleSelect
        v-if='select.feats.length'
    />

    <RadialMenu v-else-if='radial.mode'
        @close='closeRadial'
        @click='handleRadial($event)'
        ref='radial'
    />

    <template v-if='upload.shown'>
        <TablerModal>
            <div class="modal-status bg-red"></div>
            <button type="button" class="btn-close" @click='upload.shown = false' aria-label="Close"></button>
            <div class='modal-body text-white'>
                <UploadImport
                    :dragging='upload.dragging'
                    :cancelButton='false'
                    @close='upload.shown = false'
                />
            </div>
        </TablerModal>
    </template>

</div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
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
    IconX,
    IconPoint,
    IconLine,
    IconPolygon,
    IconCursorText,
    IconVector,
    IconBell,
    IconCircleArrowUp,
} from '@tabler/icons-vue';
import SelectFeats from './util/SelectFeats.vue';
import MultipleSelect from './util/MultipleSelect.vue';
import {
    TablerDropdown,
    TablerModal,
    TablerInput,
    TablerNone,
} from '@tak-ps/vue-tabler';
import Coordinate from './util/Coordinate.vue';
import Loading from '../Loading.vue';
import 'maplibre-gl/dist/maplibre-gl.css';
import RadialMenu from './RadialMenu/RadialMenu.vue';
import { mapState, mapActions } from 'pinia'
import { useMapStore } from '/src/stores/map.ts';
import { useOverlayStore } from '/src/stores/overlays.ts';
import { useProfileStore } from '/src/stores/profile.ts';
import { useCOTStore } from '/src/stores/cots.ts';
import { useConnectionStore } from '/src/stores/connection.ts';
import UploadImport from './util/UploadImport.vue'
const profileStore = useProfileStore();
const cotStore = useCOTStore();
const mapStore = useMapStore();
const overlayStore = useOverlayStore();
const connectionStore = useConnectionStore();

export default {
    name: 'CloudTAK',
    props: {
        user: {
            type: Object,
            required: true
        }
    },
    computed: {
        ...mapState(useMapStore, ['bearing', 'select', 'radial', 'isLoaded', 'selected']),
        ...mapState(useProfileStore, ['profile', 'notifications']),
        humanBearing: function() {
            if (this.bearing < 0) {
                return Math.round(this.bearing * -1) + '°'
            } else {
                return Math.round(360 - this.bearing) + '°';
            }
        },
        noMenuShown: function() {
            return !this.pointInput.shown && !this.$route.name.startsWith('home-menu')
        }
    },
    unmounted: function() {
        cotStore.$reset();
        mapStore.$reset();
        overlayStore.$reset();
        profileStore.$reset();
    },
    mounted: async function() {
        // ensure uncaught errors in the stack are captured into vue context
        window.addEventListener('error', (evt) => {
            evt.preventDefault();
            this.$emit('err', new Error(evt.message));
        });

        await profileStore.load();
        await profileStore.loadChannels();

        await cotStore.loadArchive();
        this.loading.main = false;

        window.addEventListener('dragover', (e) => {
            const dt = e.dataTransfer;
            if (dt.types && (dt.types.indexOf ? dt.types.indexOf('Files') != -1 : dt.types.contains('Files'))) {
                this.upload.shown = true;
                this.upload.dragging = true;
            }
        });

        window.addEventListener('keydown', (e) => {
            if (e.key == 'Escape') {
                if (mapStore.radial.mode) {
                    this.closeRadial()
                } else if (mapStore.select.feats) {
                    mapStore.select.feats = [];
                } else if (this.$route.path.startsWith("/")) {
                    this.$router.push("/");
                }
            }
        });

        connectionStore.connectSocket(this.user.email);

        this.$nextTick(async () => {
            return await this.mountMap();
        });
    },
    data: function() {
        return {
            mode: 'Default',
            pointInput: {
                shown: false,
                name: '',
                coordinate: []
            },
            locked: [],         // Lock the map view to a given CoT - The last element is the currently locked value
                                //   this is an array so that things like the radial menu can temporarily lock state but remember the previous lock value when they are closed
            edit: false,        // If a radial.cot is set and edit is true then load the cot into terra-draw
            upload: {
                shown: false,
                dragging: false
            },
            timer: null,        // Interval for pushing GeoJSON Map Updates (CoT)
            timerSelf: null,    // Interval for pushing your location to the server
            loading: {
                // Any Loading related states
                main: true
            },
            iconsets: { total: 0, items: [] },
        }
    },
    beforeUnmount: function() {
        if (this.timer) window.clearInterval(this.timer);
        if (this.timerSelf) window.clearInterval(this.timerSelf);
        if (connectionStore.ws) connectionStore.ws.close();

        if (mapStore.map) {
            mapStore.map.remove();
        }
    },
    watch: {
        'radial.cot': function() {
            if (mapStore.radial.cot) {
                mapStore.map.scrollZoom.disable();
                mapStore.map.touchZoomRotate.disableRotation();
                mapStore.map.dragRotate.disable();
                mapStore.map.dragPan.disable();
                this.locked.push(mapStore.radial.cot.properties.id);
            } else {
                mapStore.map.scrollZoom.enable();
                mapStore.map.touchZoomRotate.enableRotation();
                mapStore.map.dragRotate.enable();
                mapStore.map.dragPan.enable();
                this.locked.pop();
            }
        },
        edit: function() {
            if (this.edit) {
                mapStore.draw._store.create([mapStore.radial.cot]);
                mapStore.draw.start();
                mapStore.draw.setMode('polygon');
            }
        },
        'pointInput.shown': function() {
            this.pointInput.name = '';
            const center = mapStore.map.getCenter()
            this.pointInput.coordinates = [center.lng, center.lat]
        },
    },
    methods: {
        ...mapActions(useProfileStore, ['clearNotifications']),
        closeAllMenu: function() {
            this.$router.push("/");
            this.pointInput.shown = false;
        },
        submitPoint: async function() {
            this.pointInput.shown = false;
            await cotStore.add({
                type: 'Feature',
                properties: {
                    type: 'u-d-p',
                    color: '#00FF00',
                    archived: true,
                    callsign: this.pointInput.name || 'New Feature'
                },
                geometry: {
                    type: 'Point',
                    coordinates: this.pointInput.coordinates
                }
            });
        },
        closeRadial: function() {
            mapStore.radial.mode = null;
            mapStore.radial.cot = null;
        },
        toLocation: function() {
            if (!profileStore.profile.tak_loc) throw new Error('No Location Set');
            mapStore.map.flyTo({
                center: profileStore.profile.tak_loc.coordinates,
                zoom: 14
            });
        },
        setLocation: function() {
            this.mode = 'SetLocation';
            mapStore.map.getCanvas().style.cursor = 'pointer'
            mapStore.map.once('click', async (e) => {
                mapStore.map.getCanvas().style.cursor = ''
                this.mode = 'Default';
                await profileStore.update({
                    tak_loc: { type: 'Point', coordinates: [e.lngLat.lng, e.lngLat.lat] }
                })
                this.setYou();
            });
        },
        setBearing: function(bearing=0) {
            mapStore.map.setBearing(bearing);
        },
        setZoom: function(zoom) {
            mapStore.map.setZoom(zoom);
        },
        getZoom: function() {
            return mapStore.map.getZoom();
        },
        getLocation: function() {
            if (!("geolocation" in navigator)) throw new Error('GeoLocation is not available in this browser');

            navigator.geolocation.getCurrentPosition((position) => {
                mapStore.map.flyTo({
                    center: [position.coords.longitude, position.coords.latitude],
                    zoom: 14
                });
            });
        },
        startDraw: function(type) {
            mapStore.draw.start();
            mapStore.draw.setMode(type);
        },
        handleRadial: async function(event) {
            if (event === 'cot:view') {
                this.$router.push(`/cot/${this.radial.cot.id}`);
                this.closeRadial()
            } else if (event === 'cot:delete') {
                const cot = mapStore.radial.cot;
                this.closeRadial()
                await this.deleteCOT(cot);
            } else if (event === 'cot:edit') {
                //this.edit = true;
            } else if (event === 'feat:view') {
                this.$router.push(`/feat/${this.radial.cot.id}`);
                this.closeRadial()
            } else if (event === 'context:new') {
                await cotStore.add(mapStore.radial.cot);
                this.updateCOT();
                this.closeRadial()
            } else if (event === 'context:info') {
                this.$router.push(`/query/${encodeURIComponent(this.radial.cot.geometry.coordinates.join(','))}`);
                this.closeRadial()
            } else {
                this.closeRadial()
                throw new Error(`Unimplemented Radial Action: ${event}`);
            }
        },
        deleteCOT: async function(cot) {
            if (cot) {
                await cotStore.delete(cot.properties.id)
            } else {
                cotStore.clear();
            }
            await this.updateCOT();
        },
        updateCOT: async function() {
            try {
                const diff = cotStore.diff();

                for (const cot of cotStore.pending.values()) {
                    if (cotStore.cots.has(cot.id)) {
                        diff.update.push({
                            id: cot.id,
                            addOrUpdateProperties: Object.keys(cot.properties).map((key) => {
                                return { key, value: cot.properties[key] }
                            }),
                            newGeometry: cot.geometry
                        })
                    } else {
                        diff.add.push(cot);
                    }

                    cotStore.cots.set(cot.id, cot);
                }

                cotStore.pending.clear();

                for (const id of cotStore.pendingDelete) {
                    await cotStore.delete(id)
                    diff.remove.push(id);
                }
                cotStore.pendingDelete.clear();

                if (diff.add.length || diff.remove.length || diff.update.length) {
                    mapStore.map.getSource('cots').updateData(diff);
                }

                for (const sub of cotStore.subscriptions.keys()) {
                    const overlay = overlayStore.subscriptions.get(sub)
                    if (!overlay) continue;

                    const oStore = mapStore.map.getSource(`${overlay.mode}-${overlay.mode_id}-${overlay.id}`);
                    if (oStore) oStore.setData(cotStore.collection(cotStore.subscriptions.get(sub)))
                }

                if (this.locked.length && cotStore.has(this.locked[this.locked.length - 1])) {
                    const flyTo = {
                        center: cotStore.get(this.locked[this.locked.length - 1]).properties.center,
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
        },
        setYou: function() {
            if (profileStore.profile.tak_loc) {
                connectionStore.sendCOT(profileStore.CoT());
                mapStore.map.getSource('you').setData({
                    type: 'FeatureCollection',
                    features: [{
                        type: 'Feature',
                        properties: {},
                        geometry: profileStore.profile.tak_loc
                    }]
                });
            }
        },
        mountMap: async function() {
            let basemap;

            const burl = stdurl('/api/basemap');
            burl.searchParams.append('type', 'raster');
            const basemaps = await std(burl);
            if (basemaps.items.length > 0) {
                basemap = basemaps.items[0];
                basemap.url = String(stdurl(`/api/basemap/${basemap.id}/tiles/`)) + `{z}/{x}/{y}?token=${localStorage.token}`;
            }

            const turl = stdurl('/api/basemap');
            turl.searchParams.append('type', 'raster-dem');

            /* Disabled for now
            const terrains = await std(turl);
            if (terrains.items.length > 0) {
                terrain = terrains.items[0];
                terrain.url = String(stdurl(`/api/basemap/${terrain.id}/tiles/`)) + `{z}/{x}/{y}?token=${localStorage.token}`;
            }
            */

            mapStore.init(this.$refs.map, basemap);

            mapStore.map.once('idle', async () => {
                await mapStore.initLayers(basemap);

                const iconsets = await std('/api/iconset');
                for (const iconset of iconsets.items) {
                    mapStore.map.addSprite(iconset.uid, String(stdurl(`/api/icon/sprite?token=${localStorage.token}&iconset=${iconset.uid}`)))
                }

                await mapStore.initOverlays();

                mapStore.initDraw();
                this.setYou();

                mapStore.draw.on('finish', async (id) => {
                    const geometry = mapStore.draw._store.store[id].geometry;

                    const feat = {
                        id: id,
                        type: 'Feature',
                        properties: {
                            archived: true,
                            callsign: 'New Feature'
                        },
                        geometry
                    };

                    if (mapStore.draw.getMode() === 'polygon' || mapStore.draw.getMode() === 'rectangle') {
                        feat.properties.type = 'u-d-f';
                    } else if (mapStore.draw.getMode() === 'linestring') {
                        feat.properties.type = 'u-d-f';
                    } else if (mapStore.draw.getMode() === 'point') {
                        feat.properties.type = 'u-d-p';
                        feat.properties.color = '#00FF00'
                    }

                    mapStore.draw._store.delete([id]);
                    mapStore.draw.setMode('static');
                    mapStore.draw.stop();
                    await cotStore.add(feat);
                    await this.updateCOT();
                });

                this.timerSelf = window.setInterval(() => {
                    if (profileStore.profile.tak_loc) {
                        connectionStore.sendCOT(profileStore.CoT());
                    }
                }, 2000);

                this.timer = window.setInterval(async () => {
                    if (!mapStore.map) return;
                    await this.updateCOT();
                }, 500);
            });
        }
    },
    components: {
        Loading,
        SelectFeats,
        MultipleSelect,
        Coordinate,
        UploadImport,
        RadialMenu,
        TablerNone,
        TablerInput,
        TablerModal,
        TablerDropdown,
        IconSearch,
        IconMessage,
        IconLocationOff,
        IconLocation,
        IconMinus,
        IconBell,
        IconPlus,
        IconFocus2,
        IconLockAccess,
        IconPoint,
        IconLine,
        IconPolygon,
        IconVector,
        IconMenu2,
        IconPencil,
        IconCursorText,
        IconCircleArrowUp,
        IconX,
    }
}
</script>
