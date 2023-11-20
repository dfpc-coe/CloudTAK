<template>
<div class="row vh-100">
    <div ref="map" style='vh-100'></div>
</div>
</template>

<script>
import mapgl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css';

let map;

export default {
    name: 'CloudTAK',
    mounted: async function() {
        await this.fetchBaseMaps();

        this.$nextTick(() => {
            return this.mountMap();
        });
    },
    data: function() {
        return {
            basemaps: {
                total: 0,
                basemaps: []
            }
        }
    },
    beforeUnmount: function() {
        if (map) {
            map.remove();
            map = null;
        }
    },
    methods: {
        fetchBaseMaps: async function() {
            this.basemaps = await window.std('/api/basemap');
        },
        mountMap: function() {
            const basemap = this.basemaps.basemaps[0];
            const url = String(window.stdurl(`/api/basemap/${basemap.id}/tiles/`)) + `{z}/{x}/{y}?token=${localStorage.token}`;

            const tmpmap = new mapgl.Map({
                container: this.$refs.map,
                zoom: 0,
                center: basemap.center ? basemap.center : [0, 0],
                style: {
                    version: 8,
                    sources: {
                        basemap: {
                            type: 'raster',
                            tileSize: 256,
                            tiles: [ url ]
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
                    }]
                }
            });

            tmpmap.addControl(new mapgl.NavigationControl({}), "bottom-left");

            tmpmap.once('load', () => {
                map = tmpmap;
            });

            map
        }
    }
}
</script>
