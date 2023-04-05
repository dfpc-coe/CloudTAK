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
        assets: {
            type: Array,
            required: true
        },
    },
    data: function() {
        return {
            map: null,
            pmtiles: [],
            mounted: false,
            asset: null
        }
    },
    watch: {
        assets: function() {
            this.pmtiles = this.assets.assets.filter((asset) => {
                return asset.name.endsWith('.pmtiles');
            });

            if (!this.asset) this.asset = this.pmtiles[0];
        },
        asset: function() {
            if (!this.map) return;
            this.mountPMTiles();
        }
    },
    mounted: async function() {
        this.$nextTick(() => { this.mountMap(); });
    },
    methods: {
        mountMap: function() {
            this.map = new mapgl.Map({
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

            this.map.addControl(new mapgl.NavigationControl({}), "bottom-left");

            const protocol = new pmtiles.Protocol();
            mapgl.addProtocol('pmtiles', protocol.tile);

            this.mountPMTiles();
        },
        mountPMTiles: async function() {
            const res = await window.std(`/api/data/${this.$route.params.dataid}/asset/${this.asset.name}/tile`, {
                redirect: 'follow'
            });

            console.error(res);
        }
    }
}
</script>
