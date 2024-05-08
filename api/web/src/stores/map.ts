import { defineStore } from 'pinia'
import { std, stdurl } from '../std.js';
import * as pmtiles from 'pmtiles';
import mapgl from 'maplibre-gl'
import * as terraDraw from 'terra-draw';
import pointOnFeature from '@turf/point-on-feature';
import { useOverlayStore } from './overlays.js'
import type { Basemap, ProfileOverlay } from '../types.ts';
import type { Feature } from 'geojson';
import type {
    LngLat,
    Point,
    MapMouseEvent,
    LayerSpecification,
    CircleLayerSpecification,
    LineLayerSpecification,
    FillLayerSpecification,
    MapGeoJSONFeature
} from 'maplibre-gl';
const overlayStore = useOverlayStore();

export type OverlayContainer = {
    id: string;
    url?: string;
    name: string;
    save: boolean;
    visible: string;
    opacity: number;
    mode: string;
    mode_id?: string;
    overlay?: number;
    source: string;
    type: string;
    before: string;
    layers: Array<LayerSpecification>,
    clickable: Array<{
        id: string;
        type: string;
    }>
};

export const useMapStore = defineStore('cloudtak', {
    state: (): {
        map?: mapgl.Map;
        draw?: terraDraw.TerraDraw;
        container?: HTMLElement;
        isLoaded: boolean;
        bearing: number;
        selected: Map<string, MapGeoJSONFeature>;
        select: {
            mode?: string;
            e?: MapMouseEvent;
            feats: MapGeoJSONFeature[];
            x: number;
            y: number;
        },
        radial: {
            mode?: string;
            cot?: object;
            x: number;
            y: number;
        },
        layers: OverlayContainer[]
    } => {
        const protocol = new pmtiles.Protocol();
        mapgl.addProtocol('pmtiles', protocol.tile);

        return {
            isLoaded: false,
            bearing: 0,
            select: {
                mode: undefined,
                feats: [],
                x: 0, y: 0,
            },
            radial: {
                x: 0, y: 0,
            },
            layers: [],
            selected: new Map()
        }
    },
    actions: {
        addLayer: async function(layer: {
            id: string;
            name: string;
            source: string;
            layers: Array<LayerSpecification>;
            url?: string;
            save?: boolean;
            visible?: string;
            opacity?: number;
            mode?: string;
            mode_id?: string;
            overlay?: number;
            type?: string;
            before?: string;
            clickable?: Array<{ id: string; type: string; }>
        }, config: {
            initial: boolean;
        } = {
            initial: false
        }) {
            if (!this.map) throw new Error('Cannot addLayer before map has loaded');
            const map = this.map;

            if (!layer.name) throw new Error('Layer Name must be set');
            if (!layer.source) throw new Error('Layer Source must be set');
            if (!layer.clickable) layer.clickable = [];

            if (this.getLayerPos(layer.name) !== false) return;

            if (!layer.visible) layer.visible = 'visible';
            if (layer.opacity === undefined || isNaN(layer.opacity)) layer.opacity = 1;
            if (!layer.type) layer.type = 'raster';

            const overlay = layer as OverlayContainer;

            if (overlay.before) {
                const beforePos = this.getLayerPos(overlay.before)
                if (beforePos !== false) {
                    overlay.before = this.layers[beforePos].layers[0].id;
                    // @ts-expect-error Type instantiation is excessively deep and possibly infinite.
                    this.layers.splice(beforePos, 0, overlay);
                } else {
                    this.layers.push(overlay);
                }
            } else {
                this.layers.push(overlay);
            }

            for (const l of overlay.layers) {
                map.addLayer(l, layer.before);
            }

            for (const click of layer.clickable) {
                map.on('mouseenter', click.id, () => {
                    if (this.draw && this.draw.getMode() !== 'static') return;
                    map.getCanvas().style.cursor = 'pointer';
                })
                map.on('mouseleave', click.id, () => {
                    if (this.draw && this.draw.getMode() !== 'static') return;
                    map.getCanvas().style.cursor = '';
                })
            }

            if (layer.save && !config.initial) {
                if (!layer.url) throw new Error('Saved overlay must have url property');

                const overlay = await overlayStore.saveOverlay({
                    ...layer,
                    url: layer.type === 'vector' ? new URL(layer.url).pathname : layer.url,
                    visible: layer.visible === 'visible' ? true : false
                });
            }
        },
        updateLayer: async function(newLayer: OverlayContainer) {
            if (!this.map) throw new Error('Cannot updateLayer before map has loaded');

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

            if (newLayer.save && newLayer.overlay) {
                await overlayStore.updateOverlay(newLayer.overlay, {
                    visible: newLayer.visible === 'visible' ? true : false
                });
            }
        },
        removeLayerBySource: async function(source: string) {
            const pos = this.getLayerPos(source, 'source');
            if (pos === false) return
            const layer = this.layers[pos];

            await this.removeLayer(layer.name);
        },
        getLayerPos: function(name: string, key='name') {
            if (!['name', 'source'].includes(key)) throw new Error(`Unsupported Lookup Key: ${key}`);

            for (let i = 0; i < this.layers.length; i++) {
                if (key === 'name' && this.layers[i].name === name) {
                    return i;
                } else if (key === 'source' && this.layers[i].source === name) {
                    return i;
                }
            }

            return false
        },
        removeLayer: async function(name: string) {
            if (!this.map) throw new Error('Cannot removeLayer before map has loaded');

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
        init: function(container: HTMLElement, basemap?: Basemap, terrain?: Basemap) {
            this.container = container;

            const init: mapgl.MapOptions = {
                container: this.container,
                hash: true,
                attributionControl: false,
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
                        url: String(stdurl(`/api/icon/sprite?token=${localStorage.token}&iconset=default`))
                    }],
                    sources: {
                        cots: {
                            type: 'geojson',
                            cluster: false,
                            promoteId: 'id',
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

            if (typeof init.style === 'string') throw new Error('init.style must be an object');

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

            //@ts-expect-error Type instantiation is excessively deep and possibly infinite
            this.map = new mapgl.Map(init);
        },
        addDefaultLayer: async function(layer: OverlayContainer, initial=false) {
            if (!this.map) throw new Error('Cannot addDefaultLayer before map has loaded');

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
                    mode_id:  String(layer.mode_id) || layer.id.split('-')[1],
                    overlay: layer.overlay,
                    source: layer.id,
                    type: layer.type,
                    before: 'CoT Icons',
                    clickable: [
                        { id: `${layer.id}-poly`, type: 'feat' },
                        { id: `${layer.id}-polyline`, type: 'feat' },
                        { id: `${layer.id}-line`, type: 'feat' },
                        { id: `${layer.id}-icon`, type: 'feat' },
                        { id: layer.id, type: 'feat' }
                    ],
                    layers: cotStyles(layer.id, {
                        icons: layer.type === 'geojson',
                        labels: layer.type === 'geojson',
                    }),
                },
                {
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
                    name: layer.name,
                    mode: layer.id.split('-')[0],
                    mode_id:  layer.id.split('-')[1],
                    overlay: layer.overlay,
                    source: layer.id,
                    type: 'raster',
                    before: 'CoT Icons',
                    layers: [{
                        id: layer.id,
                        type: 'raster',
                        source: layer.id
                    }]
                });
            }
        },
        initLayers: async function(basemap?: Basemap) {
            if (!this.map) throw new Error('Cannot initLayers before map has loaded');
            const map = this.map;

            if (basemap) {
                await this.addLayer({
                    id: 'basemap',
                    name: basemap.name,
                    source: 'basemap',
                    type: 'raster',
                    layers: [{
                        id: 'basemap',
                        type: 'raster',
                        source: 'basemap',
                        minzoom: basemap.minzoom,
                        maxzoom: basemap.maxzoom
                    }]
                });
            }

            await this.addLayer({
                id: 'cots',
                name: 'CoT Icons',
                source: 'cots',
                type: 'vector',
                clickable: [
                    { id: 'cots', type: 'cot' },
                    { id: 'cots-poly', type: 'cot' },
                    { id: 'cots-group', type: 'cot' },
                    { id: `cots-icon`, type: 'cot' },
                    { id: 'cots-line', type: 'cot' }
                ],
                layers: cotStyles('cots', {
                    group: true,
                    icons: true,
                    labels: true
                })
            });

            await this.addLayer({
                id: 'you',
                name: 'Your Location',
                source: 'you',
                type: 'vector',
                layers: [{
                    id: 'you',
                    type: 'circle',
                    source: 'you',
                    paint: {
                        'circle-radius': 10,
                        'circle-color': '#0000f6',
                    },
                }]
            });

            map.on('rotate', () => {
                this.bearing = map.getBearing()
            })
            map.on('click', (e: MapMouseEvent) => {
                if (this.draw && this.draw.getMode() !== 'static') return;

                if (this.radial.mode) this.radial.mode = undefined;
                if (this.select.feats) this.select.feats = [];

                // Ignore Non-Clickable Layer
                const clickMap: Map<string, { type: string, id: string }> = new Map();
                for (const l of this.layers) for (const c of l.clickable) clickMap.set(c.id, c);
                const features = map.queryRenderedFeatures(e.point).filter((feat) => {
                    return clickMap.has(feat.layer.id);
                });

                if (!features.length) return;

                // MultiSelect Mode
                if (e.originalEvent.ctrlKey && features.length) {
                    this.selected.set(features[0].properties.id, features[0]);
                } else if (features.length === 1) {
                    this.radialClick(features[0], {
                        lngLat: e.lngLat,
                        point: e.point
                    })
                } else if (features.length > 1) {
                    if (e.point.x < 150 || e.point.y < 150) {
                        const flyTo: mapgl.FlyToOptions = {
                            speed: Infinity,
                            center: [e.lngLat.lng, e.lngLat.lat]
                        };

                        if (map.getZoom() < 3) flyTo.zoom = 4;
                        map.flyTo(flyTo)

                        this.select.x = this.container ? this.container.clientWidth / 2 : 0;
                        this.select.y = this.container ? this.container.clientHeight / 2 : 0;
                    } else {
                        this.select.x = e.point.x;
                        this.select.y = e.point.y;
                    }

                    this.select.e = e;
                    this.select.feats = features;
                }
            });

            map.on('contextmenu', (e) => {
                this.radialClick({
                    id: window.crypto.randomUUID(),
                    type: 'Feature',
                    properties: {
                        callsign: 'New Feature',
                        archived: true,
                        type: 'u-d-p',
                        color: '#00ff00'
                    },
                    geometry: {
                        type: 'Point',
                        coordinates: [e.lngLat.lng, e.lngLat.lat]
                    }
                }, {
                    mode: 'context',
                    point: e.point,
                    lngLat: e.lngLat
                });
            });
        },
        radialClick: async function(feat: MapGeoJSONFeature | Feature, opts: {
            lngLat: LngLat;
            point: Point;
            mode?: string;
        }): Promise<void> {
            if (!this.map) throw new Error('Cannot radialClick before map has loaded');

            // If the call is coming from MultipleSelect, ensure this menu is closed
            this.select.feats = [];

            if (!opts.mode) {
                const clickMap: Map<string, { type: string, id: string }> = new Map();
                for (const l of this.layers) for (const c of l.clickable) clickMap.set(c.id, c);
                if (!('layer' in feat)) return;
                const click = clickMap.get(feat.layer.id);
                if (!click) return;
                opts.mode = click.type;
            }

            if (opts.point.x < 150 || opts.point.y < 150) {
                const flyTo: mapgl.FlyToOptions = {
                    speed: Infinity,
                    center: [opts.lngLat.lng, opts.lngLat.lat]
                };

                if (this.map.getZoom() < 3) flyTo.zoom = 4;
                this.map.flyTo(flyTo)

                this.radial.x = this.container ? this.container.clientWidth / 2 : 0;
                this.radial.y = this.container ? this.container.clientHeight / 2 : 0;
            } else {
                this.radial.x = opts.point.x;
                this.radial.y = opts.point.y;
            }

            this.radial.cot = feat;
            this.radial.mode = opts.mode;
        },
        initOverlays: async function() {
            await overlayStore.list();
            for (const overlay of overlayStore.overlays) {
                const url = stdurl(overlay.url);
                url.searchParams.append('token', localStorage.token);

                await this.addDefaultLayer({
                    ...overlay,
                    id: `${overlay.mode}-${overlay.mode_id}-${overlay.id}`,
                    url: String(url),
                    save: true,
                    overlay: overlay.id,
                } as OverlayContainer, true)
            }
        },
        initDraw: function() {
            this.draw = new terraDraw.TerraDraw({
                // @ts-expect-error Ref: https://github.com/JamesLMilner/terra-draw/issues/248
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

function cotStyles(id: string, opts: {
    sourceLayer?: string;
    group?: boolean;
    labels?: boolean;
    icons?: boolean;
} = {
    sourceLayer: undefined,
    group: false,
    labels: false,
    icons: false
}): Array<LayerSpecification> {
    const styles: Array<LayerSpecification> = [];

    const poly: FillLayerSpecification = {
        id: `${id}-poly`,
        type: 'fill',
        source: id,
        filter: ["==", "$type", "Polygon"],
        layout: {},
        paint: {
            'fill-opacity': ['/', ["number", ["get", "fill-opacity"], 255], 255],
            'fill-color': ["string", ["get", "fill"], "#00FF00"]
        }
    }

    styles.push(poly);

    const polyline: LineLayerSpecification = {
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
            'line-opacity': ['/', ["number", ["get", "stroke-opacity"], 255], 255],
        }
    }

    styles.push(polyline);

    const line: LineLayerSpecification = {
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
            'line-opacity': ['/', ["number", ["get", "stroke-opacity"], 255], 255],
        }
    };

    styles.push(line);

    const circle: CircleLayerSpecification = {
        id: id,
        type: 'circle',
        source: id,
        filter: ['all', ["==", "$type", "Point"], ['!has', 'icon']],
        layout: {},
        paint: {
            'circle-color': ["string", ["get", "circle-color"], "#00FF00"],
            'circle-radius': ["number", ["get", "circle-radius"], 4],
            'circle-opacity': ['/', ["number", ["get", "circle-opacity"], 255], 255],
        }
    }

    if (opts.group) {
        // @ts-expect-error Type defs don't allow this
        circle.filter.push(['!has', 'group']);
    }

    styles.push(circle);

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

    if (opts.group) {
        const groupFilter: mapgl.FilterSpecification = [
            'all',
            ['==', '$type', 'Point'],
            ['has', 'group']
        ]

        styles.push({
            id: 'cots-group',
            type: 'circle',
            source: 'cots',
            filter: groupFilter,
            paint: {
                'circle-color': ['get', 'color'],
                'circle-opacity': ['/', ["number", ["get", "circle-opacity"], 255], 255],
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 2,
                'circle-radius': 10
            },
        })
    }

    if (opts.labels) {
        styles.push({
            id: `${id}-text-point`,
            type: 'symbol',
            source: id,
            filter: [ 'all', ['==', '$type', 'Point'], ],
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

        styles.push({
            id: `${id}-text-line`,
            type: 'symbol',
            source: id,
            filter: [ 'all', ['==', '$type', 'LineString'], ],
            paint: {
                'text-color': '#ffffff',
                'text-halo-color': '#000000',
                'text-halo-width': 2,
            },
            layout: {
                "symbol-placement": "line",
                'text-font': ['Open Sans Bold'],
                'text-field':  '{callsign}'
            }
        });

        styles.push({
            id: `${id}-text-poly`,
            type: 'symbol',
            source: id,
            filter: [ 'all', ['==', '$type', 'Polygon'], ],
            paint: {
                'text-color': '#ffffff',
                'text-halo-color': '#000000',
                'text-halo-width': 2,
            },
            layout: {
                'text-font': ['Open Sans Bold'],
                'text-field':  '{callsign}'
            }
        });
    }

    return styles;
}
