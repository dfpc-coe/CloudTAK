import { defineStore } from 'pinia'
import * as pmtiles from 'pmtiles';
import mapgl from 'maplibre-gl'
import * as terraDraw from 'terra-draw';

export const useMapStore = defineStore('cloudtak', {
    state: () => {
        const protocol = new pmtiles.Protocol();
        mapgl.addProtocol('pmtiles', protocol.tile);

        return {
            map: false,
            bearing: 0,
            radial: {
                // Settings related to the Radial menu - shown if radial.cot is not null
                x: 0,
                y: 0,
                cot: null
            },
            draw: false
        }
    },
    actions: {
        init: function(container, basemap) {
            this.map = new mapgl.Map({
                container,
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
                            tiles: [ basemap.url ]
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
                            'icon-rotate': ['get', 'course'],
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
                this.map.on('rotate', () => { this.bearing = this.map.getBearing() })
                this.map.on('click', layer, (e) => {
                    const flyTo = { speed: Infinity };
                    if (e.features[0].geometry.type === 'Point') {
                        flyTo.center = e.features[0].geometry.coordinates;
                    } else {
                        flyTo.center = pointOnFeature(e.features[0].geometry).geometry.coordinates;
                    }

                    // This is required to ensure the map has nowhere to flyTo - ie the whole world is shown
                    // and then the radial menu won't actually be on the CoT when the CoT is clicked
                    if (this.map.getZoom() < 3) flyTo.zoom = 4;
                    this.map.flyTo(flyTo)

                    this.radial.x = container.clientWidth / 2;
                    this.radial.y = container.clientHeight / 2;

                    this.radial.cot = e.features[0];
                });
            }

        },
        initDraw: function() {
            this.draw = new terraDraw.TerraDraw({
                adapter: new terraDraw.TerraDrawMapLibreGLAdapter({ map: this.map }),
                modes: [
                    new terraDraw.TerraDrawPointMode(),
                    new terraDraw.TerraDrawLineStringMode(),
                    new terraDraw.TerraDrawPolygonMode(),
                    new terraDraw.TerraDrawRectangleMode()
                ]
            });
        }
    },
})
