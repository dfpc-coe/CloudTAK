<template>
    <div
        v-if='pmtiles.length'
        class='card'
    >
        <TablerLoading v-if='loading' />
        <div
            v-else
            class='card-body'
        >
            <div class='row'>
                <div
                    id='map'
                    style='height: 350px;'
                />
            </div>

            <div
                v-if='geocode.loading'
                class='row'
            >
                <TablerLoading desc='Geocoding Feature...' />
            </div>
            <div
                v-else-if='geocode.result'
                class='row py-2'
            >
                <pre v-text='geocode.result' />
            </div>
        </div>
    </div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import * as pmtiles from 'pmtiles';
import mapgl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css';
import {
    TablerLoading
} from '@tak-ps/vue-tabler';

let map;

export default {
    name: 'DataLocationCard',
    components: {
        TablerLoading
    },
    props: {
        assets: {
            type: Object,
            required: true
        },
    },
    data: function() {
        return {
            loading: false,
            pmtiles: [],
            asset: null,
            geocode: {
                loading: false,
                url: null,
                result: null
            },
            style: {
                version: 8,
                sources: { },
                layers: []
            }
        }
    },
    watch: {
        'geocode.url': async function() {
            this.geocode.loading = true;
            this.geocode.result = await std(this.geocode.url);
            this.geocode.loading = false;
        },
        assets: function() {
            this.pmtiles = this.assets.assets.filter((asset) => {
                return asset.name.endsWith('.pmtiles');
            });

            if (!this.asset) this.asset = this.pmtiles[0];
        },
        asset: function() {
            this.mountMap();
        }
    },
    beforeUnmount: function() {
        if (map) {
            map.remove();
            map = null;
        }
    },
    methods: {
        basemap: async function() {
            const list = await std('/api/basemap?limit=1&order=asc&sort=created');
            if (list.basemaps.length) {
                const url = String(stdurl(`/api/basemap/${list.basemaps[0].id}/tiles/`)) + `{z}/{x}/{y}?token=${localStorage.token}`;
                this.style.sources = {
                    basemap: {
                        type: 'raster',
                        tileSize: 256,
                        tiles: [ url ]
                    }
                }

                this.style.layers = [{
                    id: 'background',
                    type: 'background',
                    paint: {
                        'background-color': 'rgb(4,7,14)'
                    }
                },{
                    'id': 'basemap',
                    'type': 'raster',
                    'source': 'basemap'
                }]
            }
        },
        mountMap: async function() {
            if (!map) {
                await this.basemap();

                this.$nextTick(() => {
                    const protocol = new pmtiles.Protocol();
                    mapgl.addProtocol('pmtiles', protocol.tile);

                    const tmpmap = new mapgl.Map({
                        container: 'map',
                        hash: "map",
                        zoom: 0,
                        center: [0, 0],
                        style: this.style
                    });

                    tmpmap.addControl(new mapgl.NavigationControl({}), "bottom-left");

                    tmpmap.once('load', () => {
                        map = tmpmap;

                        map.on('click', (e) => {
                            const url = new URL(this.assets.tiles.url + this.asset.name.replace(/.pmtiles$/, ''))
                            url.searchParams.append('query', `${e.lngLat.lng},${e.lngLat.lat}`);
                            url.searchParams.append('token', localStorage.token);
                            this.geocode.url = url;
                        });

                        this.mountPMTiles();
                    });
                });
            } else {
                this.mountPMTiles();
            }
        },
        mountPMTiles: async function() {
            if (!this.asset || !map) return;

            const url = stdurl(`/api/connection/${this.$route.params.connectionid}/data/${this.$route.params.dataid}/asset/${this.asset.name}/tile`);
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
