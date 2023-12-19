<template>
<div class="row position-relative" style='height: calc(100vh - 58px) !important;'>
    <TablerLoading v-if='loading.main'/>
    <template v-else>
        <div class='position-absolute top-0 end-0 text-white py-2' style='z-index: 1; width: 60px; background-color: rgba(0, 0, 0, 0.5);'>

            <IconMenu2 v-if='!cot && !menu.main' @click='menu.main = true' size='40' class='cursor-pointer'/>
            <IconX v-else-if='!cot && menu.main' @click='menu.main = false' size='40' class='cursor-pointer bg-dark'/>
            <IconX v-if='cot' @click='cot = false' size='40' class='cursor-pointer bg-dark'/>
        </div>

        <div class='position-absolute top-0 beginning-0 text-white py-2 mx-2' style='z-index: 1; width: 60px; background-color: rgba(0, 0, 0, 0.5)'>
            <div @click='setBearing(0)' style='padding-bottom: 10px;' class='cursor-pointer'>
                <svg width="40" height="40" :transform='`rotate(${360 - bearing})`' viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 8l-4 4" /><path d="M12 8v8" /><path d="M16 12l-4 -4" /></svg>
                <div v-if='bearing !== 0' class='text-center' v-text='`${Math.round(bearing)}°`'></div>
            </div>
            <IconFocus2 v-if='!radial.cot && !locked.length' @click='getLocation' :size='40' class='cursor-pointer'/>
            <IconLockAccess v-else-if='!radial.cot' @click='locked.splice(0, locked.length)' :size='40' class='cursor-pointer'/>

            <div class='mt-3'>
                <IconPlus size='40' @click='setZoom(getZoom() + 1);' class='cursor-pointer'/>
                <IconMinus size='40' @click='setZoom(getZoom() - 1);' class='cursor-pointer'/>
            </div>
        </div>

        <div v-if='false'
            class='position-absolute top-0 text-white py-2'
            style='z-index: 1; width: 60px; right: 60px; background-color: rgba(0, 0, 0, 0.5)'
        >
            <TablerDropdown>
                <template #default>
                    <IconPencil @click='menu.draw = true' size='40' class='cursor-pointer'/>
                </template>
                <template #dropdown>
                    <div class='btn-list'>
                        <IconPoint @click='startDraw("point")' class='cursor-pointer'/>
                        <IconLine @click='startDraw("linestring")' class='cursor-pointer'/>
                        <IconPolygon @click='startDraw("polygon")' class='cursor-pointer'/>
                        <IconVector @click='startDraw("rectangle")' class='cursor-pointer'/>
                    </div>
                </template>
            </TablerDropdown>
        </div>

        <CloudTAKMenu
            v-if='menu.main'
            @basemap='setBasemap($event)'
            @reset='deleteCOT()'
        />
        <CloudTAKCoTView
            v-if='cot'
            :cot='cot'
        />
        <div ref="map" style='vh-100'></div>
    </template>

    <RadialMenu
        v-if='radial.cot'
        @close='radial.cot = null'
        @click='handleRadial($event)'
        :x='radial.x'
        :cot='radial.cot'
        :y='radial.y'
        ref='radial'
    />
</div>
</template>

<script>
import {
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
import pointOnFeature from '@turf/point-on-feature';
import 'maplibre-gl/dist/maplibre-gl.css';
import CloudTAKMenu from './Menu.vue';
import CloudTAKCoTView from './CoTView.vue';
import RadialMenu from './RadialMenu/RadialMenu.vue';
import moment from 'moment';
import { mapState, mapActions } from 'pinia'
import { useMapStore } from '/src/stores/map.js';
const mapStore = useMapStore();

export default {
    name: 'CloudTAK',
    props: {
        user: {
            type: Object,
            required: true
        }
    },
    computed: {
        ...mapState(useMapStore, ['bearing', 'radial'])
    },
    mounted: async function() {
        await this.fetchBaseMaps();
        await this.Iconfetchsets();
        this.loading.main = false;

        window.addEventListener('keydown', (e) => {
            if (e.key == 'Escape') {
                if (this.radial.cot) {
                    this.radial.cot = false;
                } else if (this.menu.main) {
                    this.menu.main = false;
                }
            }
        });

        const url = window.stdurl('/api');
        url.searchParams.append('format', 'geojson');
        url.searchParams.append('connection', this.user.email);
        url.searchParams.append('token', localStorage.token);
        if (window.location.hostname === 'localhost') {
            url.protocol = 'ws:';
        } else {
            url.protocol = 'wss:';
        }

        this.ws = new WebSocket(url);
        this.ws.addEventListener('error', (err) => { this.$emit('err') });
        this.ws.addEventListener('message', (msg) => {
            msg = JSON.parse(msg.data);
            if (msg.type !== 'cot') return;

            //Vector Tiles only support integer IDs
            msg.data.properties.id = msg.data.id;

            if (msg.data.properties.icon) {
                // Format of icon needs to change for spritesheet
                msg.data.properties.icon = msg.data.properties.icon.replace('/', ':').replace(/.png$/, '');
            } else {
                msg.data.properties.icon = `${msg.data.properties.type}`;
            }


            // MapLibre Opacity must be of range 0-1
            if (msg.data.properties['fill-opacity']) msg.data.properties['fill-opacity'] = msg.data.properties['fill-opacity'] / 255;
            else msg.data.properties['fill-opacity'] = 255;
            if (msg.data.properties['stroke-opacity']) msg.data.properties['stroke-opacity'] = msg.data.properties['stroke-opacity'] / 255;
            else msg.data.properties['stroke-opacity'] = 255;

            this.cots.set(msg.data.id, msg.data);
        });

        this.$nextTick(() => {
            return this.mountMap();
        });

        await this.fetchImports();
    },
    data: function() {
        return {
            menu: {
                // Menu State Functions - true for shown
                main: false,
                draw: false,
            },
            locked: [],         // Lock the map view to a given CoT - The last element is the currently locked value
                                //   this is an array so that things like the radial menu can temporarily lock state but remember the previous lock value when they are closed
            edit: false,        // If a radial.cot is set and edit is true then load the cot into terra-draw
            cot: null,          // Show the CoT Viewer sidebar
            cots: new Map(),    // Store all on-screen CoT messages
            ws: null,           // WebSocket Connection for CoT events
            timer: null,        // Interval for pushing GeoJSON Map Updates (CoT)
            loading: {
                // Any Loading related states
                main: true
            },
            basemaps: { total: 0, basemaps: [] },
            iconsets: { total: 0, iconsets: [] },
            imports: { total: 0, imports: [] },
        }
    },
    beforeUnmount: function() {
        if (this.timer) window.clearInterval(this.timer);
        if (this.ws) this.ws.close();

        if (mapStore.map) {
            mapStore.map.remove();
        }
    },
    watch: {
        'radial.cot': function() {
            if (this.radial.cot) {
                mapStore.map.scrollZoom.disable();
                mapStore.map.touchZoomRotate.disableRotation();
                mapStore.map.dragRotate.disable();
                mapStore.map.dragPan.disable();
                this.locked.push(this.radial.cot.properties.id);
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
                mapStore.draw._store.create([this.radial.cot]);
                mapStore.draw.start();
                mapStore.draw.setMode('polygon');
            }
        },
        cot: function() {
            if (this.cot) this.radial.cot = null;
        }
    },
    methods: {
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
                console.error(position);
            });
        },
        startDraw: function(type) {
            mapStore.draw.start();
            mapStore.draw.setMode(type);
        },
        fetchBaseMaps: async function() {
            this.basemaps = await window.std('/api/basemap');
        },
        fetchImports: async function() {
            this.imports = await window.std('/api/import');
        },
        Iconfetchsets: async function() {
            this.iconsets = await window.std('/api/iconset');
        },
        handleRadial: function(event) {
            if (event.id === 'cot') {
                const cot = this.radial.cot;
                this.radial.cot = null;
                this.cot = cot;
            } else if (event.id === 'delete') {
                const cot = this.radial.cot;
                this.radial.cot = null;
                this.deleteCOT(cot);
            } else if (event.id === 'edit') {
                //this.edit = true;
            } else {
                this.radial.cot = null;
            }
        },
        deleteCOT: function(cot) {
            if (cot) {
                this.cots.delete(cot.properties.id)
            } else {
                this.cots.clear();
            }
            this.updateCOT();
        },
        updateCOT: function() {
            mapStore.map.getSource('cots').setData({
                type: 'FeatureCollection',
                features: Array.from(this.cots.values()).map((cot) => {
                    cot.properties['icon-opacity'] = moment().subtract(5, 'minutes').isBefore(moment(cot.properties.stale)) ? 1 : 0.5;
                    return cot;
                })
            });

            if (this.locked.length && this.cots.has(this.locked[this.locked.length - 1])) {
                const flyTo = { center: this.cots.get(this.locked[this.locked.length - 1]).properties.center, speed: Infinity };
                mapStore.map.flyTo(flyTo)
            }
        },
        setBasemap: function(basemap) {
            mapStore.map.removeLayer('basemap')
            mapStore.map.removeSource('basemap')
            const url = String(window.stdurl(`/api/basemap/${basemap.id}/tiles/`)) + `{z}/{x}/{y}?token=${localStorage.token}`;
            mapStore.map.addSource('basemap', { type: 'raster', tileSize: 256, tiles: [ url ] });
            mapStore.map.addLayer({
                id: 'basemap',
                type: 'raster',
                source: 'basemap',
                minzoom: basemap.minzoom,
                maxzoom: basemap.maxzoom
            }, 'cots');
        },
        mountMap: function() {
            const basemap = this.basemaps.basemaps[0];
            basemap.url = String(window.stdurl(`/api/basemap/${basemap.id}/tiles/`)) + `{z}/{x}/{y}?token=${localStorage.token}`;

            mapStore.init(this.$refs.map, basemap);

            mapStore.map.once('load', () => {
                mapStore.initLayers(basemap);
                mapStore.initDraw();

                for (const iconset of this.iconsets.iconsets) {
                    mapStore.map.addSprite(iconset.uid, String(window.stdurl(`/api/icon/sprite?token=${localStorage.token}&iconset=${iconset.uid}`)))
                }

                mapStore.draw.on('finish', (id) => {
                    const feat = mapStore.draw._store.store[id];

                    if (mapStore.draw.getMode() === 'polygon') {
                        feat.properties.id = id;
                        feat.properties.type = 'u-d-f';
                        feat.properties.fill = '#ff0000'
                        feat.properties.center = pointOnFeature(feat.geometry).geometry.coordinates;
                    }

                    mapStore.draw._store.delete([id]);
                    mapStore.draw.stop();
                    this.cots.set(id, feat);
                    this.updateCOT();
                });

                this.timer = window.setInterval(() => {
                    if (!mapStore.map) return;
                    this.updateCOT();
                }, 500);
            });
        }
    },
    components: {
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
        CloudTAKCoTView
    }
}
</script>
