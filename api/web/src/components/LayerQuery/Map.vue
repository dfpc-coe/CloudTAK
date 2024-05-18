<template>
    <div class='card'>
        <div class='card-body'>
            <div class='row'>
                <div
                    id='map'
                    style='height: 350px;'
                />
            </div>
        </div>
    </div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import mapgl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css';

let map;

export default {
    name: 'LayerQueryCard',
    props: {
        feature: {
            type: Object,
            required: true
        },
    },
    data: function() {
        return {
            style: {
                version: 8,
                sources: { },
                layers: []
            }
        }
    },
    beforeUnmount: function() {
        if (map) {
            map.remove();
            map = null;
        }
    },
    mounted: async function() {
        await this.mountMap();
    },
    methods: {
        basemap: async function() {
            const list = await std('/api/basemap?limit=1&order=asc&sort=created');
            if (list.items.length) {
                const url = String(stdurl(`/api/basemap/${list.items[0].id}/tiles/`)) + `{z}/{x}/{y}?token=${localStorage.token}`;
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

                        map.addSource('vector', {
                            type: 'geojson',
                            data: this.feature
                        });

                        map.addLayer({
                            'id': 'pts',
                            'type': 'circle',
                            'source': 'vector',
                            'paint': {
                                'circle-color': '#FF0000',
                                'circle-radius': 10,
                                'circle-opacity': 0.75
                            }
                        });
                    });
                });
            } else {
                this.mountPMTiles();
            }
        },
    }
}
</script>
