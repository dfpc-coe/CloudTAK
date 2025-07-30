/*
* MapStore - Maintain the state of the MapLibreGL Instance
*
* Terminology:
* - Overlay - The "container" that is saved in the DB that contains a reference to a single GIS source and potentially many rendered layers
* - Layer - MapLibre - Ref: https://maplibre.org/maplibre-style-spec/layers/
* - Source - MapLibre - Ref: https://maplibre.org/maplibre-style-spec/sources/
*/

import ms from 'milsymbol';
import { defineStore } from 'pinia'
import DrawTool, { DrawToolMode } from './modules/draw.ts';
import * as Comlink from 'comlink';
import AtlasWorker from '../workers/atlas.ts?worker&url';
import COT from '../base/cot.ts';
import { WorkerMessageType, LocationState } from '../base/events.ts';
import type { WorkerMessage } from '../base/events.ts';
import Overlay from '../base/overlay.ts';
import Subscription from '../base/subscription.ts';
import { std, stdurl } from '../std.js';
import mapgl from 'maplibre-gl'
import type Atlas from '../workers/atlas.ts';
import { CloudTAKTransferHandler } from '../base/handler.ts';
import { getSidcForCot } from '../base/utils/cot-sidc-mapping.ts';


import type { ProfileOverlay, ProfileOverlayList, Basemap, APIList, Feature, IconsetList, MapConfig } from '../types.ts';
import type { LngLat, LngLatLike, Point, MapMouseEvent, MapGeoJSONFeature, GeoJSONSource } from 'maplibre-gl';

export type TAKNotification = { type: string; name: string; body: string; url: string; created: string; }

export const useMapStore = defineStore('cloudtak', {
    state: (): {
        _map?: mapgl.Map;
        _draw?: DrawTool;
        channel: BroadcastChannel;

        // Lock the map view to a given CoT - The last element is the currently locked value
        // this is an array so that things like the radial menu can temporarily lock state but remember the previous lock value when they are closed
        locked: Array<string>;

        callsign: string;
        zoom: string;
        location: LocationState;

        permissions: {
            location: boolean;
            notification: boolean;
        }

        worker: Comlink.Remote<Atlas>;
        mission: Subscription | undefined;
        mapConfig: MapConfig;
        notifications: Array<TAKNotification>;
        container?: HTMLElement;
        hasTerrain: boolean;
        hasNoChannels: boolean;
        isTerrainEnabled: boolean;
        isLoaded: boolean;
        isOpen: boolean;
        pitch: number;
        bearing: number;
        selected: Map<string, COT>;
        select: {
            mode?: string;
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
        const worker = Comlink.wrap<Atlas>(new Worker(AtlasWorker, {
            type: 'module'
        }));

        new CloudTAKTransferHandler(
            worker,
            Comlink.transferHandlers,
            true
        );

        return {
            worker,
            callsign: 'Unknown',
            location: LocationState.Loading,
            channel: new BroadcastChannel("cloudtak"),
            zoom: 'conditional',
            locked: [],
            notifications: [],
            hasTerrain: false,
            hasNoChannels: false,
            isTerrainEnabled: false,
            isOpen: false,
            isLoaded: false,
            pitch: 0,
            bearing: 0,
            mission: undefined,
            permissions: {
                location: false,
                notification: false
            },
            select: {
                mode: undefined,
                feats: [],
                x: 0, y: 0,
            },
            mapConfig: {
                center: '-100,40',
                zoom: 4,
                pitch: 0,
                bearing: 0
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
        draw: function(): DrawTool {
            if (!this._draw) throw new Error('Drawing Tools have not yet initialized');
            // @ts-expect-error Type difference, need to investigate
            return this._draw;
        }
    },
    actions: {
        destroy: function() {
            this.channel.close();

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
                await this.worker.db.subscriptionDelete(overlay.mode_id);
            }
        },
        makeActiveMission: async function(mission?: Subscription): Promise<void> {
            this.mission = mission;

            await this.worker.db.makeActiveMission(mission ? mission.meta.guid : undefined);
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

        returnHome: function(): void {
            const flyTo = {
                zoom: this.mapConfig.zoom,
                pitch: this.mapConfig.pitch,
                bearing: this.mapConfig.bearing,
                center: this.mapConfig.center.split(',').map(Number) as LngLatLike,
                speed: Infinity
            };

            this.map.flyTo(flyTo);
        },

        /**
         * Trigger a rerender of the underlyin GeoJSON Features
         */
        refresh: async function(): Promise<void> {
            await this.updateCOT();

            const missions = [];

            for (const uid of await this.worker.db.subscriptionListUid({ dirty: true })) {
                missions.push(this.loadMission(uid));
            }
            await Promise.allSettled(missions);
        },

        updateCOT: async function(): Promise<void> {
            try {
                const diff = await this.worker.db.diff();

                if (
                    (diff.add && diff.add.length)
                    || (diff.remove && diff.remove.length)
                    || (diff.update && diff.update.length)
                ) {
                    const source = this.map.getSource('-1') as GeoJSONSource
                    if (source) source.updateData(diff);
                }

                if (this.locked.length && await this.worker.db.has(this.locked[this.locked.length - 1])) {
                    const featid = this.locked[this.locked.length - 1];
                    if (featid) {
                        const feat = await this.worker.db.get(featid);
                        if (feat && feat.geometry.type === "Point") {
                            const flyTo = {
                                center: feat.properties.center as LngLatLike,
                                speed: Infinity
                            };
                            this.map.flyTo(flyTo);

                            if (this.radial.mode) {
                                this.radial.x = this.container ? this.container.clientWidth / 2 : 0;
                                this.radial.y = this.container ? this.container.clientHeight / 2 : 0;
                            }
                        }
                    }
                }
            } catch (err) {
                console.error(err);
            }
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

            let sub = await this.worker.db.subscriptionGet(guid);

            if (!sub) {
                sub = await this.worker.db.subscriptionLoad(guid, overlay.token || undefined)
            }

            // @ts-expect-error Source.setData is not defined
            oStore.setData(await sub.collection());

            await this.worker.db.subscriptionClean(guid);

            return true;
        },
        init: async function(container: HTMLElement) {
            this.container = container;

            await this.worker.init(localStorage.token);

            this.channel.onmessage = (event: MessageEvent<WorkerMessage>) => {
                const msg = event.data;

                if (!msg || !msg.type) return;
                if (msg.type === WorkerMessageType.Map_FlyTo) {
                    if (msg.body.options.speed === null) {
                        msg.body.options.speed = Infinity;
                    }

                    map.fitBounds(msg.body.bounds, msg.body.options);
                } else if (msg.type === WorkerMessageType.Profile_Location_Source) {
                    this.location = msg.body.source as LocationState;
                } else if (msg.type === WorkerMessageType.Profile_Callsign) {
                    this.callsign = msg.body.callsign;
                } else if (msg.type === WorkerMessageType.Profile_Display_Zoom) {
                    this.zoom = msg.body.zoom;
                } else if (msg.type === WorkerMessageType.Map_Projection) {
                    map.setProjection(msg.body);
                } else if (msg.type === WorkerMessageType.Connection_Open) {
                    this.isOpen = true;
                } else if (msg.type === WorkerMessageType.Connection_Close) {
                    this.isOpen = false;
                } else if (msg.type === WorkerMessageType.Channels_None) {
                    this.hasNoChannels = true;
                } else if (msg.type === WorkerMessageType.Channels_List) {
                    this.hasNoChannels = false;
                } else if (msg.type === WorkerMessageType.Notification) {
                    this.notifications.push({
                        ...msg.body,
                        created: new Date().toISOString()
                    } as TAKNotification);
                } else if (msg.type === WorkerMessageType.Mission_Change_Feature) {
                    this.loadMission(msg.body.guid);
                }
            }

            if ("geolocation" in navigator) {
                const status = await navigator.permissions
                    .query({ name: "geolocation" })

                this.permissions.location = status.state === 'granted' ? true : false
                status.onchange = () => {
                    this.permissions.location = status.state === 'granted' ? true : false
                };

                navigator.geolocation.watchPosition((position) => {
                    if (position.coords.accuracy <= 50) {
                        this.channel.postMessage({
                            type: WorkerMessageType.Profile_Location_Coordinates,
                            body: {
                                accuracy: position.coords.accuracy,
                                coordinates: [ position.coords.longitude, position.coords.latitude ]
                            }
                        })
                    }
                }, (err) => {
                    if (err.code !== 0) {
                        console.error('Location Error', err);
                    }
                },{
                    maximumAge: 0,
                    timeout: 1500,
                    enableHighAccuracy: true
                });
            } else {
                console.error('Browser does not appear to support Geolocation');
            }

            if ('Notification' in window) {
                const status = await navigator.permissions
                    .query({ name: "notifications" })

                this.permissions.notification = status.state === 'granted' ? true : false

                if (!this.permissions.notification) {
                    Notification.requestPermission()
                }

                status.onchange = () => {
                    this.permissions.notification = status.state === 'granted' ? true : false

                    if (!this.permissions.notification) {
                        Notification.requestPermission()
                    }
                };
            } else {
                console.error('Browser does not appear to support Notifications');
            }

            const sprite = [{
                id: 'default',
                url: String(stdurl(`/api/iconset/default/sprite?token=${localStorage.token}`))
            }]

            // Eventually make a sprite URL part of the overlay so KMLs can load a sprite package & add paging support
            const iconsets = await std('/api/iconset?limit=100') as IconsetList;
            for (const iconset of iconsets.items) {
                sprite.push({
                    id: iconset.uid,
                    url: String(stdurl(`/api/iconset/${iconset.uid}/sprite?token=${localStorage.token}&alt=true`))
                });
            }

            this.mapConfig = await std('/api/config/map') as MapConfig;

            const init: mapgl.MapOptions = {
                container: this.container,
                hash: true,
                attributionControl: false,
                fadeDuration: 0,
                zoom: this.mapConfig.zoom,
                pitch: this.mapConfig.pitch,
                bearing: this.mapConfig.bearing,
                center: this.mapConfig.center.split(',').map(Number) as LngLatLike,
                maxPitch: 85,
                style: {
                    version: 8,
                    glyphs: String(stdurl('/fonts')) + '/{fontstack}/{range}.pbf',
                    sprite,
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
                        paint: { 'background-color': 'hsl(47, 26%, 88%)' }
                    }]
                }
            };

            if (!init.style || typeof init.style === 'string') throw new Error('init.style must be an object');

            const map = new mapgl.Map(init);

            this._map = map;
            this._draw = new DrawTool(this);



            // If we missed the Profile_Location_Source make sure it gets synced
            const loc = await this.worker.profile.location;
            this.location = loc.source;

            const profile = await this.worker.profile.load()
            this.callsign = profile.tak_callsign;
            this.zoom = profile.display_zoom;

            this.isOpen = await this.worker.conn.isOpen;
        },
        initOverlays: async function() {
            if (!this.map) throw new Error('Cannot initLayers before map has loaded');

            const map: mapgl.Map = this.map as mapgl.Map;

            map.on('rotate', () => {
                this.bearing = map.getBearing()
            })

            map.on('pitch', () => {
                this.pitch = map.getPitch()
            })

            map.on('styleimagemissing', (e) => {
                // Check for CoT to SIDC mapping first
                const sidc = getSidcForCot(e.id);
                if (sidc) {
                    const size = 24;
                    const data = new ms.Symbol(sidc, { size }).asCanvas();

                    createImageBitmap(data).then(bitmap => {
                        map.addImage(e.id, bitmap);
                    });
                } else if (e.id.startsWith('2525D:')) {
                    const sidcCode = e.id.replace('2525D:', '');
                    const size = 24;
                    const data = new ms.Symbol(sidcCode, { size }).asCanvas();

                    createImageBitmap(data).then(bitmap => {
                        map.addImage(e.id, bitmap);
                    });
                } else if (e.id.includes('-colored-')) {
                    // Handle colored icons by creating them on-demand
                    const parts = e.id.split('-colored-');
                    const originalIconId = parts[0];
                    const color = '#' + parts[1];
                    
                    // Wait for original icon to be available
                    const checkAndCreateColored = () => {
                        const originalImage = map.getImage(originalIconId);
                        if (originalImage) {
                            // Create colored version
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d');
                            if (!ctx) return;

                            canvas.width = originalImage.data.width;
                            canvas.height = originalImage.data.height;

                            // Create ImageData from the original image
                            const imageData = new ImageData(
                                new Uint8ClampedArray(originalImage.data.data),
                                originalImage.data.width,
                                originalImage.data.height
                            );

                            // Recolor white pixels
                            const [r, g, b] = hexToRgb(color);
                            const data = imageData.data;
                            for (let i = 0; i < data.length; i += 4) {
                                const alpha = data[i + 3];
                                if (alpha === 0) continue;
                                
                                // Check if pixel is non-black (should be recolored)
                                if (data[i] > 30 || data[i + 1] > 30 || data[i + 2] > 30) {
                                    data[i] = r;
                                    data[i + 1] = g;
                                    data[i + 2] = b;
                                }
                            }

                            // Draw to canvas and add to map
                            ctx.putImageData(imageData, 0, 0);
                            const canvasImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                            map.addImage(e.id, {
                                width: canvas.width,
                                height: canvas.height,
                                data: canvasImageData.data
                            });
                        } else {
                            // Original icon not ready, try again after a short delay
                            setTimeout(checkAndCreateColored, 10);
                        }
                    };
                    
                    checkAndCreateColored();
                }
            });
            
            // Helper function for hex to RGB conversion
            function hexToRgb(hex: string): [number, number, number] {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? [
                    parseInt(result[1], 16),
                    parseInt(result[2], 16),
                    parseInt(result[3], 16)
                ] : [0, 255, 0];
            }

            map.on('moveend', async () => {
                if (this.draw.mode !== DrawToolMode.STATIC) {
                    this.draw.snapping = await this.worker.db.snapping(this.map.getBounds().toArray());
                } else {
                    this.draw.snapping.clear();
                }
            });

            map.on('click', async (e: MapMouseEvent) => {
                if (this.draw.mode !== DrawToolMode.STATIC) return;

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
                map.queryRenderedFeatures(e.point)
                    .filter((feat) => {
                        return clickMap.has(feat.layer.id);
                    })
                    .forEach((feat) => {
                        dedupe.set(String(feat.id), feat);
                    })

                const features = Array.from(dedupe.values());

                if (!features.length) return;

                // MultiSelect Mode
                if (e.originalEvent.ctrlKey && features.length) {
                    const cot = await this.worker.db.get(features[0].properties.id, {
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

                    this.select.feats = features;
                }
            });

            map.on('contextmenu', (e) => {
                if (this.draw.editing) return;

                const id = window.crypto.randomUUID();
                this.radialClick({
                    id,
                    type: 'Feature',
                    path: '/',
                    properties: {
                        id,
                        callsign: 'New Feature',
                        archived: true,
                        type: 'u-d-p',
                        how: 'm-g',
                        time: new Date().toISOString(),
                        start: new Date().toISOString(),
                        stale: new Date(Date.now() + 2 * (60 * 60 * 1000)).toISOString(),
                        center: [ e.lngLat.lng, e.lngLat.lat ],
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
            url.searchParams.append('limit', '100');
            const profileOverlays = await std(url) as ProfileOverlayList;
            this.hasTerrain = profileOverlays.available.terrain;

            const hasBasemap = profileOverlays.items.some((o: ProfileOverlay) => {
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

            for (const item of profileOverlays.items) {
                this.overlays.push(await Overlay.create(
                    map,
                    item as ProfileOverlay,
                    {
                        skipSave: true
                    }
                ));
            }

            this.overlays.push(await Overlay.internal(map, {
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

            this.isLoaded = true;
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
        }
    }
})
