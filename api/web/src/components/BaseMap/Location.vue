<template>
<div class="row">
    <div ref="map" style='height: 350px;'></div>
</div>
</template>

<script>
import mapgl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css';

let map;

export default {
    name: 'BaseMapLocationCard',
    props: {
        basemap: {
            type: Object,
            required: true
        }
    },
    mounted: function() {
        this.$nextTick(() => {
            return this.mountMap();
        });
    },
    beforeUnmount: function() {
        if (map) {
            map.remove();
            map = null;
        }
    },
    methods: {
        mountMap: function() {
            const tmpmap = new mapgl.Map({
                container: this.$refs.map,
                zoom: 0,
                center: this.basemap.center ? this.basemap.center : [0, 0],
                style: {
                    version: 8,
                    sources: {
                        basemap: {
                            type: 'raster',
                            tileSize: 256,
                            tiles: [
                                this.basemap.url
                                    .replace('{$z}', '{z}')
                                    .replace('{$x}', '{x}')
                                    .replace('{$y}', '{y}')
                            ]
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
                        minzoom: this.basemap.minzoom,
                        maxzoom: this.basemap.maxzoom
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
