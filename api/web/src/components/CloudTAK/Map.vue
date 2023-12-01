<template>
<div class="row vh-100 position-relative">
    <TablerLoading v-if='loading.main'/>
    <template v-else>
        <div class='position-absolute top-0 end-0 text-white py-2' style='z-index: 1; width: 60px;'>
            <Menu2Icon v-if='!cot && !menu.main' @click='menu.main = true' size='40' class='cursor-pointer'/>
            <XIcon v-else-if='!cot && menu.main' @click='menu.main = false' size='40' class='cursor-pointer bg-dark'/>
            <XIcon v-if='cot' @click='cot = false' size='40' class='cursor-pointer bg-dark'/>
        </div>

        <div v-if='map && draw'
            class='position-absolute top-0 text-white py-2'
            style='z-index: 1; width: 60px; right: 60px;'
        >
            <TablerDropdown>
                <template #default>
                    <PencilIcon @click='menu.draw = true' size='40' class='cursor-pointer'/>
                </template>
                <template #dropdown>
                    <div class='btn-list'>
                        <PointIcon @click='startDraw("point")' class='cursor-pointer'/>
                        <LineIcon @click='startDraw("linestring")' class='cursor-pointer'/>
                        <PolygonIcon @click='startDraw("polygon")' class='cursor-pointer'/>
                        <VectorIcon @click='startDraw("rectangle")' class='cursor-pointer'/>
                    </div>
                </template>
            </TablerDropdown>
        </div>

        <CloudTAKMenu
            v-if='menu.main'
            :map='map'
            @basemap='setBasemap($event)'
        />
        <CloudTAKCoTView
            v-if='cot'
            :cot='cot'
            :map='map'
        />
        <div ref="map" style='vh-100'></div>
    </template>

    <RadialMenu
        v-if='radial.cot'
        @close='radial.cot = null'
        @click='handleRadial($event)'
        :x='radial.x'
        :y='radial.y'
        ref='radial'
    />
</div>
</template>

<script>
import * as pmtiles from 'pmtiles';
import mapgl from 'maplibre-gl'
import * as terraDraw from 'terra-draw';
import {
    Menu2Icon,
    PencilIcon,
    XIcon,
    PointIcon,
    LineIcon,
    PolygonIcon,
    VectorIcon,
} from 'vue-tabler-icons';
import {
    TablerDropdown,
    TablerLoading
} from '@tak-ps/vue-tabler';
import 'maplibre-gl/dist/maplibre-gl.css';
import CloudTAKMenu from './Menu.vue';
import CloudTAKCoTView from './CoTView.vue';
import RadialMenu from './RadialMenu/RadialMenu.vue';
import moment from 'moment';

export default {
    name: 'CloudTAK',
    mounted: async function() {
        await this.fetchBaseMaps();
        await this.fetchIconsets();
        this.loading.main = false;

        const url = window.stdurl('/api?format=geojson');
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
    },
    data: function() {
        return {
            menu: {
                // Menu State Functions - true for shown
                main: false,
                draw: false,
            },
            radial: {
                // Settings related to the Radial menu - shown if radial.cot is not null
                x: 0,
                y: 0,
                cot: null
            },
            locked: [],         // Lock the map view to a given CoT - The last element is the currently locked value
                                //   this is an array so that things like the radial menu can temporarily lock state but remember the previous lock value when they are closed
            cot: null,          // Show the CoT Viewer sidebar
            cots: new Map(),    // Store all on-screen CoT messages
            ws: null,           // WebSocket Connection for CoT events
            map: null,          // MapLibre map
            draw: null,         // TerraDraw Instance
            timer: null,        // Interval for pushing GeoJSON Map Updates (CoT)
            loading: {
                // Any Loading related states
                main: true
            },
            basemaps: { total: 0, basemaps: [] },
            iconsets: { total: 0, iconsets: [] },
        }
    },
    beforeUnmount: function() {
        if (this.timer) window.clearInterval(this.timer);
        if (this.ws) this.ws.close();

        if (this.map) {
            this.map.remove();
            this.map = null;
        }
    },
    watch: {
        'radial.cot': function() {
            if (this.radial.cot) {
                this.map.scrollZoom.disable();
                this.map.touchZoomRotate.disableRotation();
                this.map.dragRotate.disable();
                this.map.dragPan.disable();
                this.locked.push(this.radial.cot.properties.id);
            } else {
                this.map.scrollZoom.enable();
                this.map.touchZoomRotate.enableRotation();
                this.map.dragRotate.enable();
                this.map.dragPan.enable();
                this.locked.pop();
            }
        },
        cot: function() {
            if (this.cot) this.radial.cot = null;
        }
    },
    methods: {
        startDraw: function(type) {
            this.draw.start();
            this.draw.setMode(type);
        },
        fetchBaseMaps: async function() {
            this.basemaps = await window.std('/api/basemap');
        },
        fetchIconsets: async function() {
            this.iconsets = await window.std('/api/iconset');
        },
        handleRadial: function(event) {
            const cot = this.radial.cot;
            this.radial.cot = null;
            if (event.id === 'cot') {
                this.cot = cot;
            } else if (event.id === 'delete') {
                this.deleteCOT(cot);
            } else {
                this.radial.cot = null;
            }
        },
        deleteCOT: function(cot) {
            this.cots.delete(cot.properties.id)
            this.updateCOT();
        },
        updateCOT: function() {
            this.map.getSource('cots').setData({
                type: 'FeatureCollection',
                features: Array.from(this.cots.values()).map((cot) => {
                    cot.properties['icon-opacity'] = moment().subtract(5, 'minutes').isBefore(moment(cot.properties.stale)) ? 1 : 0.5;
                    return cot;
                })
            });

            if (this.locked.length && this.cots.has(this.locked[this.locked.length - 1])) {
                const flyTo = { center: this.cots.get(this.locked[this.locked.length - 1]).geometry.coordinates, speed: Infinity };
                this.map.flyTo(flyTo)
            }
        },
        setBasemap: function(basemap) {
            this.map.removeLayer('basemap')
            this.map.removeSource('basemap')
            const url = String(window.stdurl(`/api/basemap/${basemap.id}/tiles/`)) + `{z}/{x}/{y}?token=${localStorage.token}`;
            this.map.addSource('basemap', { type: 'raster', tileSize: 256, tiles: [ url ] });
            this.map.addLayer({
                id: 'basemap',
                type: 'raster',
                source: 'basemap',
                minzoom: basemap.minzoom,
                maxzoom: basemap.maxzoom
            }, 'cots');
        },
        mountMap: function() {
            const basemap = this.basemaps.basemaps[0];
            const url = String(window.stdurl(`/api/basemap/${basemap.id}/tiles/`)) + `{z}/{x}/{y}?token=${localStorage.token}`;

            const protocol = new pmtiles.Protocol();
            mapgl.addProtocol('pmtiles', protocol.tile);

            this.map = new mapgl.Map({
                container: this.$refs.map,
                fadeDuration: 0,
                zoom: 8,
                center: [-105.91873757464982, 39.2473040734323],
                style: {
                    version: 8,
                    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
                    sprite: [{
                        id: 'default',
                        url: String(window.stdurl(`/api/icon/sprite?token=${localStorage.token}&iconset=default`))
                    }],
                    sources: {
                        basemap: {
                            type: 'raster',
                            tileSize: 256,
                            tiles: [ url ]
                        },
                        cots: {
                            type: 'geojson',
                            cluster: false,
                            data: { type: 'FeatureCollection', features: [] }
                        }
                    },
                    layers: [{
                        id: 'background',
                        type: 'background',
                        paint: { 'background-color': 'rgb(4,7,14)' }
                    },{
                        id: 'basemap',
                        type: 'raster',
                        source: 'basemap',
                        minzoom: basemap.minzoom,
                        maxzoom: basemap.maxzoom
                    },{
                        id: 'cots-poly',
                        type: 'fill',
                        source: 'cots',
                        filter: [ 'all', ['==', '$type', 'Polygon']],
                        paint: {
                            'fill-color': ['get', 'fill'],
                            'fill-opacity': ['get', 'fill-opacity']
                        },
                    },{
                        id: 'cots-line',
                        type: 'line',
                        source: 'cots',
                        paint: {
                            'line-color': ['get', 'stroke'],
                            'line-opacity': ['get', 'stroke-opacity'],
                            'line-width': ['get', 'stroke-width'],
                        },
                    },{
                        id: 'cots',
                        type: 'symbol',
                        source: 'cots',
                        paint: {
                            'icon-opacity': ['get', 'icon-opacity'],
                            'icon-halo-color': '#ffffff',
                            'icon-halo-width': 4
                        },
                        layout: {
                            'icon-size': 1,
                            'icon-allow-overlap': true,
                            'icon-image': '{icon}',
                            'icon-anchor': 'bottom',
                        }
                    },{
                        id: 'cots-text',
                        type: 'symbol',
                        source: 'cots',
                        paint: {
                            'text-color': '#ffffff',
                            'text-halo-color': '#000000',
                            'text-halo-width': 2,
                        },
                        layout: {
                            'text-offset': [0, 1],
                            'text-font': ['Open Sans Bold'],
                            'text-field':  '{callsign}'
                        }
                    }]
                }
            });

            for (const layer of ['cots', 'cots-poly', 'cots-line']) {
                this.map.on('mouseenter', layer, () => { this.map.getCanvas().style.cursor = 'pointer'; })
                this.map.on('mouseleave', layer, () => { this.map.getCanvas().style.cursor = ''; })
                this.map.on('click', layer, (e) => {
                    const flyTo = { center: e.features[0].geometry.coordinates, speed: Infinity };
                    // This is required to ensure the map has nowhere to flyTo - ie the whole world is shown
                    // and then the radial menu won't actually be on the CoT when the CoT is clicked
                    if (this.map.getZoom() < 3) flyTo.zoom = 4;
                    this.map.flyTo(flyTo)

                    this.radial.x = this.$refs.map.clientWidth / 2;
                    this.radial.y = this.$refs.map.clientHeight / 2;

                    this.radial.cot = e.features[0];
                });
            }

            this.map.once('load', () => {
                this.draw = new terraDraw.TerraDraw({
                    adapter: new terraDraw.TerraDrawMapLibreGLAdapter({ map: this.map }),
                    modes: [
                        new terraDraw.TerraDrawPointMode(),
                        new terraDraw.TerraDrawLineStringMode(),
                        new terraDraw.TerraDrawPolygonMode(),
                        new terraDraw.TerraDrawRectangleMode()
                    ]
                });


                for (const iconset of this.iconsets.iconsets) {
                    this.map.addSprite(iconset.uid, String(window.stdurl(`/api/icon/sprite?token=${localStorage.token}&iconset=${iconset.uid}`)))
                }

                this.draw.on('finish', (id) => {
                    const feat = this.draw._store.store[id];

                    if (this.draw.getMode() === 'polygon') {
                        feat.properties.id = id;
                        feat.properties.type = 'u-d-f';
                        feat.properties.fill = '#ff0000'
                    }

                    this.draw._store.delete([id]);
                    this.draw.stop();
                    this.cots.set(id, feat);
                    this.updateCOT();
                });

                this.timer = window.setInterval(() => {
                    if (!this.map) return;
                    this.updateCOT();
                }, 500);
            });
        }
    },
    components: {
        RadialMenu,
        PointIcon,
        LineIcon,
        PolygonIcon,
        VectorIcon,
        TablerDropdown,
        Menu2Icon,
        PencilIcon,
        XIcon,
        TablerLoading,
        CloudTAKMenu,
        CloudTAKCoTView
    }
}
</script>
