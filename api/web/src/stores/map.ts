/*
* MapStore - Maintain the state of the MapLibreGL Instance
*
* Terminology:
* - Overlay - The "container" that is saved in the DB that contains a reference to a single GIS source and potentially many rendered layers
* - Layer - MapLibre - Ref: https://maplibre.org/maplibre-style-spec/layers/
* - Source - MapLibre - Ref: https://maplibre.org/maplibre-style-spec/sources/
*/

import { defineStore } from 'pinia'
import type { Position } from "geojson";
import COT from './base/cot.ts';
import Subscription from './base/mission.ts';
import Overlay from './base/overlay.ts';
import { std, stdurl } from '../std.js';
import mapgl from 'maplibre-gl'
import * as terraDraw from 'terra-draw';
import type { ProfileOverlay, Basemap, APIList } from '../types.ts';
import { coordEach } from '@turf/meta';
import { distance } from '@turf/distance';
import type { Feature } from 'geojson';
import type {
    LngLat,
    Point,
    MapMouseEvent,
    MapGeoJSONFeature
} from 'maplibre-gl';
import { useCOTStore } from './cots.js'

export const useMapStore = defineStore('cloudtak', {
    state: (): {
        _map?: mapgl.Map;
        _draw?: terraDraw.TerraDraw;
        edit: COT | undefined;
        container?: HTMLElement;
        hasTerrain: boolean;
        isTerrainEnabled: boolean;
        isLoaded: boolean;
        bearing: number;
        selected: Map<string, COT>;
        drawOptions: {
            mode: string;
            pointMode: string;
        },
        select: {
            mode?: string;
            e?: MapMouseEvent;
            feats: MapGeoJSONFeature[];
            x: number;
            y: number;
        },
        radial: {
            mode: string | undefined;
            cot: Feature | MapGeoJSONFeature | undefined;
            x: number;
            y: number;
        },
        overlays: Array<Overlay>
    } => {
        return {
            hasTerrain: false,
            isTerrainEnabled: false,
            isLoaded: false,
            bearing: 0,
            edit: undefined,
            select: {
                mode: undefined,
                feats: [],
                x: 0, y: 0,
            },
            drawOptions: {
                mode: 'static',
                pointMode: 'u-d-p'
            },
            radial: {
                mode: undefined,
                cot: undefined,
                x: 0, y: 0,
            },
            overlays: [],

            selected: new Map()
        }
    },
    getters: {
        map: function(): mapgl.Map {
            if (!this._map) throw new Error('Map has not yet initialized');
            // @ts-expect-error Maplibre Type difference, need to investigate
            return this._map;
        },
        draw: function(): terraDraw.TerraDraw {
            if (!this._draw) throw new Error('Drawing Tools have not yet initialized');
            // @ts-expect-error Maplibre Type difference, need to investigate
            return this._draw;
        }
    },
    actions: {
        destroy: function() {
            if (this._map) {
                try {
                    this._map.remove();
                    delete this._map;
                } catch (err) {
                    console.error(err);
                }
            }
            this.$reset();
        },
        removeOverlay: async function(overlay: Overlay) {
            // @ts-expect-error Doesn't like use of object to index array
            const pos = this.overlays.indexOf(overlay)
            if (pos === -1) return;

            this.overlays.splice(pos, 1)

            await overlay.delete();
            if (overlay.mode === 'mission' && overlay.mode_id) {
                const cotStore = useCOTStore();
                cotStore.subscriptions.delete(overlay.mode_id);
            }
        },
        getOverlayById(id: number): Overlay | null {
            for (const overlay of this.overlays) {
                if (overlay.id === id) return overlay as Overlay
            }

            return null;
        },
        getOverlayByMode(mode: string, mode_id: string): Overlay | null {
            for (const overlay of this.overlays) {
                if (overlay.mode === mode && overlay.mode_id === mode_id) {
                    return overlay as Overlay;
                }
            }

            return null;
        },
        listTerrain: async function(): Promise<APIList<Basemap>> {
            // Courtesy add terrain data
            const burl = stdurl('/api/basemap');
            burl.searchParams.append('type', 'raster-dem');
            burl.searchParams.append('limit', '1');
            const basemaps = await std(burl) as APIList<Basemap>;

            return basemaps;
        },

        // TODO: Convert to overlay
        addTerrain: async function(): Promise<void> {
            const basemaps = await this.listTerrain();
            if (basemaps.items.length && !this.map.getSource('-2')) {
                this.map.addSource('-2', {
                    type: 'raster-dem',
                    url: String(stdurl(`/api/basemap/${basemaps.items[0].id}/tiles?token=${localStorage.token}`)),
                        tileSize: 256
                })

                this.map.setTerrain({
                    source: '-2',
                    exaggeration: 1.5
                });

                this.isTerrainEnabled = true;
            } else {
                this.hasTerrain = false;
            }
        },

        removeTerrain: function(): void {
            this.map.setTerrain(null);
            this.map.removeSource('-2');

            this.isTerrainEnabled = false;
        },

        /**
         * Given a mission Guid, attempt to refresh the Map Layer, loading the mission if it isn't already loaded
         * @returns {boolean} True if successful, false if not
         */
        loadMission: async function(guid: string): Promise<boolean> {
            const overlay = this.getOverlayByMode('mission', guid)
            if (!overlay || !overlay.mode_id) return false;

            if (!this.map) throw new Error('Cannot loadMission before map has loaded');
            const oStore = this.map.getSource(String(overlay.id));
            if (!oStore) return false

            const cotStore = useCOTStore();

            let sub = cotStore.subscriptions.get(guid);

            if (!sub) {
                sub = await Subscription.load(guid, overlay.token || undefined);
                cotStore.subscriptions.set(guid, sub)
            }

            // @ts-expect-error Source.setData is not defined
            oStore.setData(sub.collection());

            return true;
        },
        init: function(container: HTMLElement) {
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
                    glyphs: String(stdurl('/fonts')) + '/{fontstack}/{range}.pbf',
                    sprite: [{
                        id: 'default',
                        url: String(stdurl(`/api/icon/sprite?token=${localStorage.token}&iconset=default`))
                    }],
                    sources: {
                        '-1': {
                            type: 'geojson',
                            cluster: false,
                            promoteId: 'id',
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

            if (!init.style || typeof init.style === 'string') throw new Error('init.style must be an object');

            this._map = new mapgl.Map(init);
        },
        initOverlays: async function() {
            if (!this.map) throw new Error('Cannot initLayers before map has loaded');

            const map: mapgl.Map = this.map as mapgl.Map;

            map.on('rotate', () => {
                this.bearing = map.getBearing()
            })

            map.on('click', (e: MapMouseEvent) => {
                if (this.draw.getMode() !== 'static') return;

                if (this.radial.mode) this.radial.mode = undefined;
                if (this.select.feats) this.select.feats = [];

                // Ignore Non-Clickable Layer
                const clickMap: Map<string, { type: string, id: string }> = new Map();
                for (const overlay of this.overlays) {
                    for (const c of overlay._clickable) {
                        clickMap.set(c.id, c);
                    }
                }

                // Each Visual Layer will return a Feature for a click
                // Since a single "feature" may exist in multiple layers (text, polygon, line) etc
                // dedupe them based on the ID
                const dedupe: Map<string, MapGeoJSONFeature> = new Map();
                map.queryRenderedFeatures(e.point).filter((feat) => {
                    return clickMap.has(feat.layer.id);
                }).forEach((feat) => {
                    dedupe.set(String(feat.id), feat);
                })
                const features = Array.from(dedupe.values());

                if (!features.length) return;

                // MultiSelect Mode
                if (e.originalEvent.ctrlKey && features.length) {
                    const cotStore = useCOTStore();
                    const cot = cotStore.get(features[0].properties.id, {
                        mission: true
                    });

                    if (!cot) return;
                    this.selected.set(cot.id, cot);
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
                if (this.edit) return;

                this.radialClick({
                    id: window.crypto.randomUUID(),
                    type: 'Feature',
                    properties: {
                        callsign: 'New Feature',
                        archived: true,
                        type: 'u-d-p',
                        how: 'm-g',
                        'marker-color': '#00ff00',
                        'marker-opacity': 1
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

            const url = stdurl('/api/profile/overlay');
            url.searchParams.append('sort', 'pos');
            url.searchParams.append('order', 'asc');
            const items = ((await std(url)) as APIList<ProfileOverlay>).items;

            const hasBasemap = items.some((o: ProfileOverlay) => {
                return o.mode === 'basemap'
            });

            // Courtesy add an initial basemap
            if (!hasBasemap) {
                const burl = stdurl('/api/basemap');
                burl.searchParams.append('type', 'raster');
                const basemaps = await std(burl) as APIList<Basemap>;

                if (basemaps.items.length > 0) {
                    const basemap = await Overlay.create(map, {
                        name: basemaps.items[0].name,
                        pos: -1,
                        type: 'raster',
                        url: String(stdurl(`/api/basemap/${basemaps.items[0].id}/tiles`)),
                        mode: 'basemap',
                        mode_id: String(basemaps.items[0].id)
                    });

                    this.overlays.push(basemap);
                }
            }

            if ((await this.listTerrain()).total > 0) {
                this.hasTerrain = true;
            }

            for (const item of items) {
                this.overlays.push(new Overlay(
                    map,
                    item as ProfileOverlay
                ));
            }

            this.overlays.push(Overlay.internal(map, {
                id: -1,
                name: 'CoT Icons',
                type: 'geojson',
            }));

            // Data Syncs are specially loaded as they are dynamic
            for (const overlay of this.overlays) {
                if (overlay.mode === 'mission' && overlay.mode_id) {
                    const source = map.getSource(String(overlay.id));

                    if (!source) continue;

                    try {
                        await this.loadMission(overlay.mode_id);
                    } catch (err) {
                        // TODO: Handle this gracefully
                        // The Mission Sync is either:
                        // - Deleted
                        // - Part of a channel that is no longer active
                        overlay._error = err instanceof Error ? err : new Error(String(err));
                    }
                }
            }
        },
        /**
         * Determine if the feature is from the CoT store or a clicked VT feature
         */
        featureSource: function(feat: MapGeoJSONFeature | Feature): string | void {
            const clickMap: Map<string, { type: string, id: string }> = new Map();
            for (const overlay of this.overlays) {
                for (const c of overlay._clickable) {
                    clickMap.set(c.id, c);
                }
            }

            if (!('layer' in feat)) return;
            const click = clickMap.get(feat.layer.id);
            if (!click) return;
            return click.type;
        },
        radialClick: async function(feat: MapGeoJSONFeature | Feature, opts: {
            lngLat: LngLat;
            point: Point;
            mode?: string;
        }): Promise<void> {
            // If the call is coming from MultipleSelect, ensure this menu is closed
            this.select.feats = [];

            if (!opts.mode) opts.mode = this.featureSource(feat) || 'feat';

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
        initDraw: function() {
            const cotStore = useCOTStore();

            const toCustom = (event: terraDraw.TerraDrawMouseEvent): Position | undefined => {
                let closest: {
                    dist: number
                    cot: COT | undefined
                    coord: Position
                } | undefined = undefined;

                cotStore.filter((cot) => {
                    coordEach(cot.geometry, (coord: Position) => {
                        const dist = distance([event.lng, event.lat], coord);

                        if (!closest || (dist < closest.dist)) {
                            closest = { dist, cot, coord }
                        }
                    });

                    return false;
                }, { mission: true})

                if (closest) {
                    // Base Threshold / Math.pow(decayFactor, zoomLevel)
                    const threshold = 1000 / Math.pow(2, this.map.getZoom());

                    // @ts-expect-error Somehow getting assigned a never value
                    if (closest.dist < threshold) {
                        // @ts-expect-error Somehow getting assigned a never value
                        return closest.coord;
                    }

                    return;
                } else {
                    return;
                }
            }

            this._draw = new terraDraw.TerraDraw({
                adapter: new terraDraw.TerraDrawMapLibreGLAdapter({
                    map: this.map
                }),
                idStrategy: {
                    isValidId: (id: string | number): boolean => {
                        return typeof id === "string"
                    },
                    getId: (function () {
                        return function () {
                            return crypto.randomUUID()
                        };
                    })()
                },
                modes: [
                    new terraDraw.TerraDrawPointMode(),
                    new terraDraw.TerraDrawLineStringMode({
                        snapping: { toCustom }
                    }),
                    new terraDraw.TerraDrawPolygonMode({
                        snapping: { toCustom }
                    }),
                    new terraDraw.TerraDrawAngledRectangleMode(),
                    new terraDraw.TerraDrawFreehandMode(),
                    new terraDraw.TerraDrawSectorMode(),
                    new terraDraw.TerraDrawSelectMode({
                        flags: {
                            polygon: {
                                feature: {
                                    draggable: true,
                                    coordinates: {
                                        deletable: true,
                                        midpoints: true,
                                        draggable: true,
                                    }
                                }
                            },
                            linestring: {
                                feature: {
                                    draggable: true,
                                    coordinates: {
                                        deletable: true,
                                        midpoints: true,
                                        draggable: true,
                                    }
                                }
                            },
                            point: {
                                feature: {
                                    draggable: true
                                }
                            }
                        }
                    })
                ]
            });
            this.isLoaded = true;
        }
    },
})
