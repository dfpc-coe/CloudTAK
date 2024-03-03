import { defineStore } from 'pinia'
import * as pmtiles from 'pmtiles';
import mapgl from 'maplibre-gl'
import * as terraDraw from 'terra-draw';
import pointOnFeature from '@turf/point-on-feature';
import { useOverlayStore } from './overlays.js'
const overlayStore = useOverlayStore();

export const useMapStore = defineStore('cloudtak', {
    state: () => {
        const protocol = new pmtiles.Protocol();
        mapgl.addProtocol('pmtiles', protocol.tile);

        return {
            map: false,
            container: false,
            isLoaded: false,
            bearing: 0,
            radial: {
                mode: null,
                x: 0,
                y: 0,
                cot: null
            },
            layers: [],
            draw: false
        }
    },
    actions: {
        addLayer: async function(layer, layers, config = {
            initial: false
        }) {
            if (!layer.name) throw new Error('Layer Name must be set');
            if (!layer.source) throw new Error('Layer Source must be set');
            if (!layer.clickable) layer.clickable = [];

            if (this.getLayerPos(layer.name) !== false) return;

            if (!layer.visible) layer.visible = 'visible';
            if (isNaN(layer.opacity)) layer.opacity = 1;
            if (!layer.type) layer.type = 'raster';

            layer.layers = layers;

            const beforePos = this.getLayerPos(layer.before)
            if (layer.before && beforePos !== false) {
                layer.before = this.layers[beforePos].layers[0].id;
                this.layers.splice(layer.before, 0, layer);
            } else {
                this.layers.push(layer);
            }

            for (const l of layer.layers) {
                this.map.addLayer(l, layer.before);
            }

            for (const click of layer.clickable) {
                this.map.on('mouseenter', click.id, () => {
                    if (this.draw && this.draw.getMode() !== 'static') return;
                    this.map.getCanvas().style.cursor = 'pointer';
                })
                this.map.on('mouseleave', click.id, () => {
                    if (this.draw && this.draw.getMode() !== 'static') return;
                    this.map.getCanvas().style.cursor = '';
                })
                this.map.on('click', click.id, (e) => {
                    if (this.draw && this.draw.getMode() !== 'static') return;
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

                    this.radial.x = this.container.clientWidth / 2;
                    this.radial.y = this.container.clientHeight / 2;

                    this.radial.cot = e.features[0];
                    this.radial.mode = click.type;
                });
            }

            if (layer.save && !config.initial) {
                layer.overlay = await overlayStore.saveOverlay({
                    ...layer,
                    url: layer.type === 'vector' ? new URL(layer.url).pathname : layer.url,
                    visible: layer.visible === 'visible' ? true : false
                });
            }
        },
        updateLayer: function(newLayer) {
            const pos = this.getLayerPos(newLayer.name);
            if (pos === false) return
            this.layers[pos] = newLayer;

            for (const l of newLayer.layers) {
                if (newLayer.type === 'raster') {
                    this.map.setPaintProperty(l.id, 'raster-opacity', Number(newLayer.opacity))
                }

                if (newLayer.visible === 'none') {
                    this.map.setLayoutProperty(l.id, 'visibility', 'none');
                } else if (newLayer.visible === 'visible') {
                    this.map.setLayoutProperty(l.id, 'visibility', 'visible');
                }
            }
        },
        removeLayerBySource: async function(source) {
            const pos = this.getLayerPos(source, 'source');
            if (pos === false) return
            const layer = this.layers[pos];

            await this.removeLayer(layer.name);
        },
        getLayerPos: function(name, key='name') {
            for (let i = 0; i < this.layers.length; i++) {
                if (this.layers[i][key] === name) {
                    return i;
                }
            }

            return false
        },
        removeLayer: async function(name) {
            const pos = this.getLayerPos(name);
            if (pos === false) return;
            const layer = this.layers[pos];

            this.layers.splice(pos, 1)

            for (const l of layer.layers) {
                this.map.removeLayer(l.id);
            }

            this.map.removeSource(layer.source);

            if (layer.save && layer.overlay) {
                await overlayStore.deleteOverlay(layer.overlay);
            }
        },
        init: function(container, basemap, terrain) {
            this.container = container;

            const init = {
                container: this.container,
                fadeDuration: 0,
                zoom: 8,
                pitch: 0,
                bearing: 0,
                maxPitch: 85,
                center: [-105.91873757464982, 39.2473040734323],
                style: {
                    version: 8,
                    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
                    sprite: [{
                        id: 'default',
                        url: String(window.stdurl(`/api/icon/sprite?token=${localStorage.token}&iconset=default`))
                    }],
                    sources: {
                        cots: {
                            type: 'geojson',
                            cluster: false,
                            data: { type: 'FeatureCollection', features: [] }
                        },
                        you: {
                            type: 'geojson',
                            cluster: false,
                            data: { type: 'FeatureCollection', features: [] }
                        }
                    },
                    layers: [{
                        id: 'background',
                        type: 'background',
                        paint: { 'background-color': 'rgb(4,7,14)' }
                    }]
                }
            };

            if (basemap) {
                init.style.sources.basemap = {
                    type: 'raster',
                    tileSize: 256,
                    tiles: [ basemap.url ]
                }
            }

            if (terrain) {
                init.style.sources.terrain = {
                    type: 'raster-dem',
                    tileSize: 256,
                    tiles: [ terrain.url ]
                }

                init.style.terrain = {
                    source: 'terrain',
                }
            }

            this.map = new mapgl.Map(init);
        },
        addDefaultLayer: async function(layer, initial=false) {
            if (this.map.getSource(layer.id)) {
                this.map.removeSource(layer.id);
            }

            if (layer.type ==='vector') {
                this.map.addSource(layer.id, {
                    type: 'vector',
                    url: String(layer.url)
                });
            } else if (layer.type === 'geojson') {
                if (!this.map.getSource(layer.id)) {
                    this.map.addSource(layer.id, {
                        type: 'geojson',
                        cluster: false,
                        data: { type: 'FeatureCollection', features: [] }
                    })
                }
            }

            if (['vector', 'geojson'].includes(layer.type)) {
                await this.addLayer({
                    id: layer.id,
                    url: layer.url,
                    save: true,
                    name: layer.name || layer.id,
                    mode: layer.mode || layer.id.split('-')[0],
                    mode_id:  layer.mode_id || Number(layer.id.split('-')[1]),
                    overlay: layer.overlay || null,
                    source: layer.id,
                    type: layer.type,
                    before: 'CoT Icons',
                    clickable: [
                        { id: `${layer.id}-poly`, type: 'feat' },
                        { id: `${layer.id}-polyline`, type: 'feat' },
                        { id: `${layer.id}-line`, type: 'feat' },
                        { id: `${layer.id}-icon`, type: 'feat' },
                        { id: layer.id, type: 'feat' }
                    ]
                }, cotStyles(layer.id, {
                    sourceLayer: layer.type === 'vector' ? 'out' : undefined,
                    icons: layer.type === 'geojson',
                    labels: layer.type === 'geojson',
                }), {
                    initial: initial
                });
            } else {
                this.map.addSource(layer.id, {
                    type: 'raster',
                    tileSize: 256,
                    url: String(layer.url)
                });

                await this.addLayer({
                    id: layer.id,
                    url: layer.url,
                    save: true,
                    name: layer.name || id,
                    mode: layer.id.split('-')[0],
                    mode_id:  Number(layer.id.split('-')[1]),
                    overlay: layer.overlay || null,
                    source: layer.id,
                    type: 'raster',
                    before: 'CoT Icons',
                },[{
                    id: layer.id,
                    type: 'raster',
                    source: layer.id
                }]);
            }
        },
        initLayers: async function(basemap) {
            await this.addLayer({
                name: basemap.name,
                source: 'basemap',
                type: 'raster',
            }, [{
                id: 'basemap',
                type: 'raster',
                source: 'basemap',
                minzoom: basemap.minzoom,
                maxzoom: basemap.maxzoom
            }]);

            await this.addLayer({
                name: 'CoT Icons',
                source: 'cots',
                type: 'vector',
                clickable: [
                    { id: 'cots', type: 'cot' },
                    { id: 'cots-poly', type: 'cot' },
                    { id: 'cots-group', type: 'cot' },
                    { id: `cots-icon`, type: 'cot' },
                    { id: 'cots-line', type: 'cot' }
                ]
            }, cotStyles('cots', {
                group: true,
                icons: true,
                labels: true
            }));

            await this.addLayer({
                name: 'Your Location',
                source: 'you',
                type: 'vector'
            }, [{
                id: 'you',
                type: 'circle',
                source: 'you',
                paint: {
                    'circle-radius': 10,
                    'circle-color': '#0000f6',
                },
            }]);

            this.map.on('rotate', () => { this.bearing = this.map.getBearing() })
            this.map.on('contextmenu', (e) => {
                this.radial.mode = 'context';
                const flyTo = {
                    speed: Infinity,
                    center: [e.lngLat.lng, e.lngLat.lat]
                };

                if (this.map.getZoom() < 3) flyTo.zoom = 4;
                this.map.flyTo(flyTo)

                this.radial.x = this.container.clientWidth / 2;
                this.radial.y = this.container.clientHeight / 2;
            });
        },
        initOverlays: async function() {
            await overlayStore.list();
            for (const overlay of overlayStore.overlays) {
                if (overlay.mode == 'mission') {
                    overlay.overlay = overlay.id;
                    overlay.id = `${overlay.mode}-${overlay.mode_id}-${overlay.id}`;
                    overlay.save = true;
                    await this.addDefaultLayer(overlay, true)
                } else {
                    const url = window.stdurl(overlay.url);
                    url.searchParams.append('token', localStorage.token);
                    overlay.url = String(url);
                    overlay.overlay = overlay.id;
                    overlay.id = `${overlay.mode}-${overlay.mode_id}-${overlay.id}`;
                    overlay.save = true;
                    await this.addDefaultLayer(overlay, true)
                }
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
            this.isLoaded = true;
        }
    },
})

function cotStyles(id, opts = {
    sourceLayer: undefined,
    group: false,
    labels: false,
    icons: false
}) {
    const styles = [{
        id: `${id}-poly`,
        type: 'fill',
        source: id,
        filter: ["==", "$type", "Polygon"],
        layout: {},
        paint: {
            'fill-opacity': ["number", ["get", "fill-opacity"], 1],
            'fill-color': ["string", ["get", "fill"], "#00FF00"]
        }
    },{
        id: `${id}-polyline`,
        type: 'line',
        source: id,
        filter: ["==", "$type", "Polygon"],
        layout: {
            'line-join': 'round',
            'line-cap': 'round'
        },
        paint: {
            'line-color': ["string", ["get", "stroke"], "#00FF00"],
            'line-width': ["number", ["get", "stroke-width"], 3],
            'line-opacity': ["number", ["get", "stroke-opacity"], 1]
        }
    },{
        id: `${id}-line`,
        type: 'line',
        source: id,
        filter: ["==", "$type", "LineString"],
        layout: {
            'line-join': 'round',
            'line-cap': 'round'
        },
        'paint': {
            'line-color': ["string", ["get", "stroke"], "#00FF00"],
            'line-width': ["*", 2, ["number", ["get", "stroke-width"], 3]],
            'line-opacity': ["number", ["get", "stroke-opacity"], 1]
        }
    },{
        id: id,
        type: 'circle',
        source: id,
        filter: ['all', ["==", "$type", "Point"], ['!has', 'icon']],
        paint: {
            'circle-color': ["string", ["get", "circle-color"], "#00FF00"],
            'circle-radius': ["number", ["get", "circle-radius"], 4],
            'circle-opacity': ["number", ["get", "circle-opacity"], 1]
        }
    }]

    if (opts.icons) {
        styles.push({
            id: `${id}-icon`,
            type: 'symbol',
            source: id,
            filter: [
                'all',
                ['==', '$type', 'Point'],
                ['has', 'icon']
            ],
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
                'icon-anchor': 'center',
            }
        })
    }

    if (opts.labels) {
        styles.push({
            id: `${id}-text`,
            type: 'symbol',
            source: id,
            paint: {
                'text-color': '#ffffff',
                'text-halo-color': '#000000',
                'text-halo-width': 2,
            },
            layout: {
                'text-offset': [0, 2],
                'text-font': ['Open Sans Bold'],
                'text-field':  '{callsign}'
            }
        });
    }

    if (opts.group) {
        const groupFilter = [
            'all',
            ['==', '$type', 'Point'],
            ['has', 'color']
        ]
        styles.push({
            id: 'cots-group',
            type: 'circle',
            source: 'cots',
            filter: groupFilter,
            paint: {
                'circle-color': ['get', 'color'],
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 2,
                'circle-radius': 10
            },
        })
    }

    return styles.map((s) => {
        if (opts.sourceLayer && typeof opts.sourceLayer === 'string') {
            s['source-layer'] = opts.sourceLayer;
        }
        return s;
    });
}
