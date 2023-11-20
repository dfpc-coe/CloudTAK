<template>
<div class="row vh-100">
    <div ref="map" style='vh-100'></div>
</div>
</template>

<script>
import mapgl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css';

export default {
    name: 'CloudTAK',
    mounted: async function() {
        await this.fetchBaseMaps();

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
            this.cots.set(msg.data.id, msg.data);
        });

        this.$nextTick(() => {
            return this.mountMap();
        });
    },
    data: function() {
        return {
            ws: null,
            map: null,
            timer: null,
            basemaps: {
                total: 0,
                basemaps: []
            },
            cots: new Map()
        }
    },
    beforeUnmount: function() {
        if (this.map) {
            this.map.remove();
            this.map = null;
        }

        if (this.timer) {
            window.clearInterval(this.timer)
        }
    },
    methods: {
        fetchBaseMaps: async function() {
            this.basemaps = await window.std('/api/basemap');
        },
        mountMap: function() {
            const basemap = this.basemaps.basemaps[0];
            const url = String(window.stdurl(`/api/basemap/${basemap.id}/tiles/`)) + `{z}/{x}/{y}?token=${localStorage.token}`;

            this.map = new mapgl.Map({
                container: this.$refs.map,
                zoom: 0,
                center: basemap.center ? basemap.center : [0, 0],
                style: {
                    version: 8,
                "glyphs": "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
                sprite: [{
                    id: 'default',
                    url: "https://demotiles.maplibre.org/styles/osm-bright-gl-style/sprite"
                }],
                    sources: {
                        basemap: {
                            type: 'raster',
                            tileSize: 256,
                            tiles: [ url ]
                        },
                        cots: {
                            type: 'geojson',
                            data: { type: 'FeatureCollection', features: [] }
                        }
                    },
                    layers: [{
                        id: 'background',
                        type: 'background',
                        paint: {
                            'background-color': 'rgb(4,7,14)'
                        }
                    },{
                        id: 'basemap',
                        type: 'raster',
                        source: 'basemap',
                        minzoom: basemap.minzoom,
                        maxzoom: basemap.maxzoom
                    },{
                        id: 'cots',
                        type: 'symbol',
                        source: 'cots',
                        paint: {
                            'text-color': '#ffffff',
                        },
                        layout: {
                            'icon-image': "airfield_11",
                            'text-font': ['Open Sans Bold'],
                            'text-field':  ['get', 'callsign']
                        }
                    }]
                }
            });

            this.map.once('load', () => {
                this.timer = window.setInterval(() => {
                    if (!this.map) return;
                    this.map.getSource('cots').setData({
                        type: 'FeatureCollection',
                        features: Array.from(this.cots.values())
                    });
                }, 1000);
            });
        }
    }
}
</script>
