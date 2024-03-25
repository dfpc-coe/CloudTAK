<template>
<div data-bs-theme="dark" class="d-flex position-relative" style='height: calc(100vh - 58px) !important;'>
    <TablerLoading v-if='loading.main'/>
    <template v-else>
        <div
            v-if='mode === "Default"'
            class='position-absolute top-0 end-0 text-white py-2'
            style='z-index: 1; width: 60px; background-color: rgba(0, 0, 0, 0.5);'
       >
            <IconMenu2 v-if='noMenuShown' @click='$router.push("/menu")' size='40' class='mx-2 cursor-pointer'/>
            <IconX v-if='!noMenuShown' @click='$router.push("/"); cot = feat = false' size='40' class='mx-2 cursor-pointer bg-dark'/>
        </div>

        <div v-if='profile' class='position-absolute bottom-0 begin-0 text-white' style='z-index: 1; width: 200px; background-color: rgba(0, 0, 0, 0.5);'>
            <div class='d-flex align-items-center'>
                <div class='mx-2 hover-dark rounded py-2 px-2 cursor-pointer' v-tooltip='"Set Location"'>
                    <IconLocationOff size='32' @click='setLocation' v-if='!profile.tak_loc'/>
                    <IconLocation size='32' @click='setLocation' v-else/>
                </div>
                <div
                    v-text='profile.tak_callsign'
                    @click='toLocation'
                    class='mx-1 my-1 cursor-pointer hover-dark px-2 py-2 rounded'
                    v-tooltip='"To Location"'
                ></div>
            </div>
        </div>

        <div
            v-if='mode === "Default"'
            class='position-absolute top-0 beginning-0 text-white py-2 px-2'
            style='z-index: 1; width: 60px; background-color: rgba(0, 0, 0, 0.5)'>
            <div @click='setBearing(0)' style='padding-bottom: 10px;' class='cursor-pointer'>
                <svg width="40" height="40" :transform='`rotate(${360 - bearing})`' viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 8l-4 4" /><path d="M12 8v8" /><path d="M16 12l-4 -4" /></svg>
                <div v-if='bearing !== 0' class='text-center' v-text='humanBearing'></div>
            </div>
            <IconFocus2 v-if='!radial.cot && !locked.length' @click='getLocation' size='40' class='cursor-pointer'/>
            <IconLockAccess v-else-if='!radial.cot' @click='locked.splice(0, locked.length)' size='40' class='cursor-pointer'/>

            <div class='mt-3'>
                <IconPlus size='40' @click='setZoom(getZoom() + 1);' class='cursor-pointer'/>
                <IconMinus size='40' @click='setZoom(getZoom() - 1);' class='cursor-pointer'/>
            </div>
        </div>

        <div v-if='isLoaded && mode === "Default"'
            class='position-absolute top-0 text-white py-2'
            style='z-index: 1; width: 60px; right: 60px; background-color: rgba(0, 0, 0, 0.5)'
        >
            <TablerDropdown>
                <template #default>
                    <IconPencil @click='menu.draw = true' size='40' class='mx-2 cursor-pointer'/>
                </template>
                <template #dropdown>
                    <div class='btn-list my-2'>
                        <IconPoint      size='35' @click='startDraw("point")' class='cursor-pointer'/>
                        <IconLine       size='35' @click='startDraw("linestring")' class='cursor-pointer'/>
                        <IconPolygon    size='35' @click='startDraw("polygon")' class='cursor-pointer'/>
                        <IconVector     size='35' @click='startDraw("rectangle")' class='cursor-pointer'/>
                    </div>
                </template>
            </TablerDropdown>
        </div>

        <router-view @reset='deleteCOT()'/>

        <CloudTAKCoTView
            v-if='cot && mode === "Default"'
            :cot='cot'
        />
        <CloudTAKFeatView
            v-if='feat && mode === "Default"'
            :feat='feat'
        />
        <div
            ref="map"
            style='width: 100%;'
        ></div>
    </template>

    <RadialMenu
        v-if='radial.mode'
        @close='closeRadial'
        @click='handleRadial($event)'
        :mode='radial.mode'
        :x='radial.x'
        :y='radial.y'
        ref='radial'
    />
</div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
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
    IconVector,
} from '@tabler/icons-vue';
import {
    TablerDropdown,
    TablerLoading
} from '@tak-ps/vue-tabler';
import 'maplibre-gl/dist/maplibre-gl.css';
import CloudTAKMenu from './Menu.vue';
import CloudTAKCoTView from './CoTView.vue';
import CloudTAKFeatView from './FeatView.vue';
import RadialMenu from './RadialMenu/RadialMenu.vue';
import moment from 'moment';
import { mapState, mapActions } from 'pinia'
import { useMapStore } from '/src/stores/map.ts';
import { useOverlayStore } from '/src/stores/overlays.ts';
import { useProfileStore } from '/src/stores/profile.js';
import { useCOTStore } from '/src/stores/cots.ts';
import { useConnectionStore } from '/src/stores/connection.ts';
const cotStore = useCOTStore();
const mapStore = useMapStore();
const overlayStore = useOverlayStore();
const profileStore = useProfileStore();
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
        ...mapState(useMapStore, ['bearing', 'radial', 'isLoaded']),
        ...mapState(useProfileStore, ['profile']),
        humanBearing: function() {
            if (this.bearing < 0) {
                return Math.round(this.bearing * -1) + '°'
            } else {
                return Math.round(360 - this.bearing) + '°';
            }
        },
        noMenuShown: function() {
            return !this.cot && !this.feat && !this.$route.path.startsWith('/menu')
        }
    },
    unmounted: function() {
        cotStore.$reset();
        mapStore.$reset();
        overlayStore.$reset();
        profileStore.$reset();
    },
    mounted: async function() {
        const emit = this.$emit;

        // ensure uncaught errors in the stack are captured into vue context
        window.addEventListener('error', (evt) => {
            evt.preventDefault();
            emit('err', new Error(evt.message));
        });

        await profileStore.load();
        await cotStore.loadArchive();
        this.loading.main = false;

        window.addEventListener('keydown', (e) => {
            if (e.key == 'Escape') {
                if (mapStore.radial.mode) {
                    this.closeRadial()
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
            menu: {
                // Menu State Functions - true for shown
                draw: false,
            },
            locked: [],         // Lock the map view to a given CoT - The last element is the currently locked value
                                //   this is an array so that things like the radial menu can temporarily lock state but remember the previous lock value when they are closed
            edit: false,        // If a radial.cot is set and edit is true then load the cot into terra-draw
            cot: null,          // Show the CoT Viewer sidebar
            feat: null,         // Show the Feat Viewer sidebar
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
        cot: function() {
            if (this.cot) this.closeRadial();
        }
    },
    methods: {
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
        handleRadial: function(event) {
            if (event === 'cot:view') {
                const cot = mapStore.radial.cot;
                this.closeRadial()
                this.cot = cot;
            } else if (event === 'cot:delete') {
                const cot = mapStore.radial.cot;
                this.closeRadial()
                this.deleteCOT(cot);
            } else if (event === 'cot:edit') {
                //this.edit = true;
            } else if (event === 'feat:view') {
                this.feat = mapStore.radial.cot;
                this.closeRadial()
            } else if (event === 'context:new') {
                cotStore.add(mapStore.radial.cot);
                this.updateCOT();
                this.closeRadial()
            } else {
                this.closeRadial()
                throw new Error(`Unimplemented Radial Action: ${event}`);
            }
        },
        deleteCOT: function(cot) {
            if (cot) {
                cotStore.delete(cot.properties.id)
            } else {
                cotStore.clear();
            }
            this.updateCOT();
        },
        updateCOT: function() {
            try {
                mapStore.map.getSource('cots').setData(cotStore.collection())

                for (const sub of cotStore.subscriptions.keys()) {
                    const overlay = overlayStore.subscriptions.get(sub)
                    if (!overlay) continue;

                    const oStore = mapStore.map.getSource(overlay.id);
                    if (oStore) oStore.setData(cotStore.collection(cotStore.subscriptions.get(sub)))
                }

                if (this.locked.length && cotStore.has(this.locked[this.locked.length - 1])) {
                    const flyTo = {
                        center: cotStore.get(this.locked[this.locked.length - 1]).properties.center,
                        speed: Infinity
                    };
                    mapStore.map.flyTo(flyTo);
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
            let basemap, terrain;

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

                mapStore.draw.on('finish', (id) => {
                    const feat = mapStore.draw._store.store[id];

                    feat.id = id;
                    feat.properties.archive = true;
                    feat.properties.callsign = 'New Feature'
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
                    cotStore.add(feat);
                    this.updateCOT();
                });

                this.timerSelf = window.setInterval(() => {
                    if (profileStore.profile.tak_loc) {
                        connectionStore.sendCOT(profileStore.CoT());
                    }
                }, 2000);

                this.timer = window.setInterval(() => {
                    if (!mapStore.map) return;
                    this.updateCOT();
                }, 500);
            });
        }
    },
    components: {
        IconLocationOff,
        IconLocation,
        IconMinus,
        IconPlus,
        IconFocus2,
        IconLockAccess,
        RadialMenu,
        IconPoint,
        IconLine,
        IconPolygon,
        IconVector,
        TablerDropdown,
        IconMenu2,
        IconPencil,
        IconX,
        TablerLoading,
        CloudTAKMenu,
        CloudTAKCoTView,
        CloudTAKFeatView,
    }
}
</script>
