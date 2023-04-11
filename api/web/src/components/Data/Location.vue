<template>
<div v-if='pmtiles.length' class="card">
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

let map;

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
            pmtiles: [],
            tilejson: false,
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
            if (!map) return;
            this.mountPMTiles();
        }
    },
    mounted: async function() {
        this.$nextTick(() => { this.mountMap(); });
    },
    methods: {
        mountMap: function() {
            const protocol = new pmtiles.Protocol();
            mapgl.addProtocol('pmtiles', protocol.tile);

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

                this.mountPMTiles();
            });
        },
        mountPMTiles: async function() {
            if (!this.asset || !map) return;

            const url = window.stdurl(`/api/data/${this.$route.params.dataid}/asset/${this.asset.name}/tile`);
            url.searchParams.append('token', localStorage.token);
            map.addSource('vector', {
                type: 'vector',
                url: String(url)
            });

            map.addLayer({
                id: 'polygons',
                type: 'fill',
                source: 'vector',
                'source-layer': 'out',
                filter: ["==", "$type", "Polygon"],
                layout: {},
                paint: {
                    'fill-opacity': 0.1,
                    'fill-color': '#FF0000',
                }
            });

            map.addLayer({
                id: 'polygons-outline',
                type: 'line',
                source: 'vector',
                'source-layer': 'out',
                filter: ["==", "$type", "Polygon"],
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': '#FF0000',
                    'line-width': 1,
                    'line-opacity': 0.75
                }
            });

            map.addLayer({
                'id': 'lines',
                'type': 'line',
                'source': 'vector',
                'source-layer': 'out',
                'filter': ["==", "$type", "LineString"],
                'layout': {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                'paint': {
                    'line-color': '#FF0000',
                    'line-width': 1,
                    'line-opacity': 0.75
                }
            });

            map.addLayer({
                'id': 'pts',
                'type': 'circle',
                'source': 'vector',
                'source-layer': 'out',
                'filter': ["==", "$type", "Point"],
                'paint': {
                    'circle-color': '#FF0000',
                    'circle-radius': 2.5,
                    'circle-opacity': 0.75
                }
            });

            map.once('idle', () => {
                const source = map.getSource('vector');

                map.fitBounds(source.bounds, {
                    padding: 20
                });
            })
        }
    }
}
</script>
