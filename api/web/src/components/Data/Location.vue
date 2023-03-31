<template>
<div class="card">
    <div class="card-body">
        <div class="row">
            <div id="map" style='height: 350px;'></div>
        </div>
    </div>
</div>
</template>

<script>
import * as pmtiles from 'pmtiles';
import mapgl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css';

export default {
    name: 'LocationCard',
    props: {
        asset: {
            type: Object,
            required: true
        },
    },
    mounted: async function() {
        this.$nextTick(() => { this.mountMap(); });
    },
    methods: {
        mountMap: function() {
            const map = new mapgl.Map({
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

            map.addControl(new mapgl.NavigationControl({}), "bottom-left");

            const protocol = new pmtiles.Protocol();
            mapgl.addProtocol('pmtiles', protocol.tile);
        }
    }
}
</script>
