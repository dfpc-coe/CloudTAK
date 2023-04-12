<template>
<div class="row">
    <div id="map" style='height: 350px;'></div>
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
    methods: {
        mountMap: function() {
            const tmpmap = new mapgl.Map({
                container: 'map',
                hash: "map",
                zoom: 0,
                center: [0, 0],
                style: {
                    version: 8,
                    sources: {},
                    layers: [],
                },
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
