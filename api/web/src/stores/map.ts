/*
* MapStore - Maintain the state of the MapLibreGL Instance
*
* Terminology:
* - Overlay - The "container" that is saved in the DB that contains a reference to a single GIS source and potentially many rendered layers
* - Layer - MapLibre - Ref: https://maplibre.org/maplibre-style-spec/layers/
* - Source - MapLibre - Ref: https://maplibre.org/maplibre-style-spec/sources/
*/

import { v4 as randomUUID } from 'uuid';
import { defineStore } from 'pinia'
import { markRaw } from 'vue';
import DrawTool, { DrawToolMode } from './modules/draw.ts';
import IconManager from './modules/icons.ts';
import MenuManager from './modules/menu.ts';
import * as Comlink from 'comlink';
import AtlasWorker from '../workers/atlas.ts?worker&url';
import COT from '../base/cot.ts';
import type { DatabaseType } from '../base/database.ts';
import { db } from '../base/database.ts';
import { WorkerMessageType, LocationState } from '../base/events.ts';
import type { WorkerMessage } from '../base/events.ts';
import Overlay from '../base/overlay.ts';
import Subscription from '../base/subscription.ts';
import { std, stdurl } from '../std.js';
import mapgl from 'maplibre-gl'
import type Atlas from '../workers/atlas.ts';
import { CloudTAKTransferHandler } from '../base/handler.ts';

import type { ProfileOverlay, ProfileOverlayList, Basemap, APIList, Feature, MapConfig } from '../types.ts';
import type { LngLat, LngLatLike, Point, MapMouseEvent, MapGeoJSONFeature, GeoJSONSource } from 'maplibre-gl';

export type TAKNotification = { type: string; name: string; body: string; url: string; created: string; }

export const useMapStore = defineStore('cloudtak', {
    state: (): {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        _map?: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        _draw?: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        _icons?: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        _menu?: any;

        db: DatabaseType;
        channel: BroadcastChannel;

        toImport: Feature[]

        // Lock the map view to a given CoT - The last element is the currently locked value
        // this is an array so that things like the radial menu can temporarily lock state but remember the previous lock value when they are closed
        locked: Array<string>;

        callsign: string;
        zoom: string;
        location: LocationState;
        distanceUnit: string;
        manualLocationMode: boolean;
        isMobileDetected: boolean;
        gpsWatchId: number | null;

        toastOffset: {
            x: number;
            y: number;
        };

        permissions: {
            location: boolean;
            notification: boolean;
        }

        worker: Comlink.Remote<Atlas>;
        mission: Subscription | undefined;
        mapConfig: MapConfig;
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
            feats: Array<COT | MapGeoJSONFeature>;
            x: number;
            y: number;
            popup?: mapgl.Popup;
        },
        radial: {
            mode: string | undefined;
            cot: Feature | MapGeoJSONFeature | undefined;
            x: number;
            y: number;
            lngLat?: LngLat;
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
            toImport: [],
            location: LocationState.Loading,
            db,
            channel: new BroadcastChannel("cloudtak"),
            zoom: 'conditional',
            distanceUnit: 'meter',
            toastOffset: { x: 70, y: 10 },
            manualLocationMode: false,
            gpsWatchId: null,
            isMobileDetected: false,
            locked: [],
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
                lngLat: undefined
            },
            overlays: [],

            selected: new Map()
        }
    },
    getters: {
        map: function(): mapgl.Map {
            if (!this._map) throw new Error('Map has not yet initialized');
            return this._map as mapgl.Map;
        },
        draw: function(): DrawTool {
            if (!this._draw) throw new Error('Drawing Tools have not yet initialized');
            return this._draw as DrawTool;
        },
        icons: function(): IconManager {
            if (!this._icons) throw new Error('Icon Manager has not yet initialized');
            return this._icons as IconManager;
        },
        menu: function(): MenuManager {
            if (!this._menu) throw new Error('Menu Manager has not yet initialized');
            return this._menu as MenuManager;
        }
    },
    actions: {
        destroy: function() {
            this.channel.close();

            // Clean up GPS watch
            if (this.gpsWatchId !== null) {
                navigator.geolocation.clearWatch(this.gpsWatchId);
                this.gpsWatchId = null;
            }

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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pos = (this.overlays as any[]).indexOf(overlay)
            if (pos === -1) return;

            this.overlays.splice(pos, 1)

            await overlay.delete();
            if (overlay.mode === 'mission' && overlay.mode_id) {
                const sub = await Subscription.from(overlay.mode_id, localStorage.token, {
                    subscribed: true
                });

                if (sub) {
                    await sub.update({ subscribed: false });
                }
            }
        },
        makeActiveMission: async function(mission?: Subscription): Promise<void> {
            this.mission = mission;
            await this.worker.db.makeActiveMission(mission ? mission.meta.guid : undefined);

            if (mission) {
                for (const overlay of this.overlays) {
                    if (overlay.mode !== 'mission' || !overlay.mode_id) continue;

                    if (overlay.mode_id !== mission.meta.guid && overlay.active) {
                        // The API call to make active will disable all active overlays on the backend so no need for networkIO
                        overlay.active = false;
                    } else if (overlay.mode_id === mission.meta.guid) {
                        overlay.active = true;

                        await overlay.save();
                    }
                }
            } else {
                for (const overlay of this.overlays) {
                    if (overlay.mode !== 'mission' || !overlay.mode_id) continue;

                    if (overlay.active) {
                        overlay.active = false;
                        await overlay.save();
                    }
                }
            }
        },
        getOverlayById(id: number): Overlay | null {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const overlay of (this.overlays as any[])) {
                if (overlay.id === id) return overlay as Overlay
            }

            return null;
        },
        getOverlayByName(name: string): Overlay | null {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const overlay of (this.overlays as any[])) {
                if (overlay.name === name) return overlay as Overlay
            }

            return null;
        },
        getOverlayByMode(mode: string, mode_id: string): Overlay | null {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const overlay of (this.overlays as any[])) {
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
         * Trigger a rerender of the underlying GeoJSON Features
         */
        refresh: async function(): Promise<void> {
            await this.updateCOT();
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
        loadMission: async function(
            guid: string,
            opts?: {
                reload: boolean;
            }
        ): Promise<Subscription | null> {
            const overlay = this.getOverlayByMode('mission', guid)
            if (!overlay || !overlay.mode_id) {
                console.error(`Mission:${guid} not found in overlays`);
                return null;
            }

            if (!this.map) throw new Error('Cannot loadMission before map has loaded');
            const oStore = this.map.getSource(String(overlay.id));

            if (!oStore) {
                console.error(`Mission:${guid} No Source Found`);
                return null
            }

            const sub = await Subscription.load(guid, {
                token: localStorage.token,
                reload: opts?.reload || false,
                subscribed: true,
                missiontoken: overlay.token || undefined
            });

            // @ts-expect-error Source.setData is not defined
            oStore.setData(await sub.feature.collection(false));

            await sub.update({ dirty: false });

            return sub;
        },
        init: async function(container: HTMLElement) {
            this.container = container;

            await this.worker.init(localStorage.token);

            this.channel.onmessage = async (event: MessageEvent<WorkerMessage>) => {
                const msg = event.data;

                if (!msg || !msg.type) return;

                if (msg.type === WorkerMessageType.Map_FitBounds) {
                    if (msg.body.options.speed === null) {
                        msg.body.options.speed = Infinity;
                    }

                    map.fitBounds(msg.body.bounds, msg.body.options);
                } else if (msg.type === WorkerMessageType.Map_FlyTo) {
                    if (msg.body.speed === null) {
                        msg.body.speed = Infinity;
                    }

                    if (!msg.body.zoom) msg.body.zoom = this.map.getZoom();

                    map.flyTo(msg.body);
                } else if (msg.type === WorkerMessageType.Profile_Location_Source) {
                    this.location = msg.body.source as LocationState;
                } else if (msg.type === WorkerMessageType.Profile_Callsign) {
                    this.callsign = msg.body.callsign;
                } else if (msg.type === WorkerMessageType.Profile_Display_Zoom) {
                    this.zoom = msg.body.zoom;
                } else if (msg.type === WorkerMessageType.Profile_Icon_Rotation) {
                    this.updateIconRotation(msg.body.enabled);
                } else if (msg.type === WorkerMessageType.Profile_Distance_Unit) {
                    this.updateDistanceUnit(msg.body.unit);
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
                } else if (msg.type === WorkerMessageType.Mission_Change_Feature) {
                    await this.loadMission(msg.body.guid);
                } else if (msg.type === WorkerMessageType.Contact_Change) {
                    if (this._menu) await this._menu.updateContactsCount();
                }
            }

            if ("geolocation" in navigator) {
                const status = await navigator.permissions
                    .query({ name: "geolocation" })

                this.permissions.location = status.state === 'granted' ? true : false
                status.onchange = () => {
                    this.permissions.location = status.state === 'granted' ? true : false
                };

                this.startGPSWatch();
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

            const sprites = await IconManager.sprites();
            this.mapConfig = await std('/api/config/map') as MapConfig;

            const init: mapgl.MapOptions = {
                container: this.container,
                hash: true,
                attributionControl: {},
                fadeDuration: 0,
                zoom: this.mapConfig.zoom,
                pitch: this.mapConfig.pitch,
                bearing: this.mapConfig.bearing,
                center: this.mapConfig.center.split(',').map(Number) as LngLatLike,
                maxPitch: 85,
                style: {
                    version: 8,
                    glyphs: String(stdurl('/api/fonts')) + '/{fontstack}/{range}.pbf?token=' + localStorage.token,
                    sprite: sprites,
                    sources: {
                        '-1': {
                            type: 'geojson',
                            cluster: false,
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

            // Add scale control
            const scaleControl = new mapgl.ScaleControl({
                maxWidth: 100,
                unit: 'metric'
            });
            map.addControl(scaleControl, 'bottom-left');
            // Store reference for later use
            (map as mapgl.Map & { _scaleControl?: mapgl.ScaleControl })._scaleControl = scaleControl;

            this._map = markRaw(map);
            this._draw = markRaw(new DrawTool(this));
            this._icons = markRaw(new IconManager(map));
            this._menu = markRaw(new MenuManager(this));
            await this._menu!.init();

            // If we missed the Profile_Location_Source make sure it gets synced
            const loc = await this.worker.profile.location;
            this.location = loc.source;

            const profile = await this.worker.profile.load()
            this.callsign = profile.tak_callsign;
            this.zoom = profile.display_zoom;
            // Initialize icon rotation setting after overlays are loaded
            setTimeout(() => {
                this.updateIconRotation(profile.display_icon_rotation);
            }, 100);

            this.distanceUnit = profile.display_distance;

            // Initialize scale control settings
            this.updateDistanceUnit(profile.display_distance);

            this.isOpen = await this.worker.conn.isOpen;
        },
        startGPSWatch: function(): void {
            if (!("geolocation" in navigator)) return;

            // Clear existing watch if any
            if (this.gpsWatchId !== null) {
                navigator.geolocation.clearWatch(this.gpsWatchId);
            }

            this.gpsWatchId = navigator.geolocation.watchPosition((position) => {
                if (!this.manualLocationMode) {
                    this.channel.postMessage({
                        type: WorkerMessageType.Profile_Location_Coordinates,
                        body: {
                            accuracy: position.coords.accuracy,
                            altitude: position.coords.altitude,
                            coordinates: [ position.coords.longitude, position.coords.latitude ]
                        }
                    })
                }
            }, (err) => {
                if (err.code !== 0) {
                    console.error('Location Error', err);
                }
            }, {
                maximumAge: 0,
                timeout: 1500,
                enableHighAccuracy: true
            });
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
                this.icons.onStyleImageMissing(e);
            })

            map.on('moveend', async () => {
                if (this.draw.mode !== DrawToolMode.STATIC) {
                    this.draw.snapping = await this.worker.db.snapping(this.map.getBounds().toArray());
                } else {
                    this.draw.snapping.clear();
                }
            });

            map.on('click', async (e: MapMouseEvent) => {
                if (this.draw.mode !== DrawToolMode.STATIC) return;

                if (this.radial.mode) {
                    // Clicking away closes the radial menu
                    this.radial.mode = undefined;
                    this.radial.cot = undefined;
                    return;
                }

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
                        dedupe.set(String(feat.properties.id || feat.id), feat);
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

                    const feats = [];

                    for (const feat of features) {
                        // TODO: Support Multi Select with both CoT and VT Features
                        if (!feat.properties.id) continue;

                        const cot = await this.worker.db.get(feat.properties.id, {
                            mission: true
                        });

                        if (cot) {
                            feats.push(cot);
                        } else {
                            feats.push(feat);
                        }
                    }

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    this.select.feats = feats as any;
                }
            });

            map.on('contextmenu', (e) => {
                if (this.draw.editing) return;

                const id = randomUUID();
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
                    const basemap = await Overlay.create({
                        name: basemaps.items[0].name,
                        pos: -1,
                        type: 'raster',
                        url: String(stdurl(`/api/basemap/${basemaps.items[0].id}/tiles`)),
                        mode: 'basemap',
                        mode_id: String(basemaps.items[0].id)
                    });

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (this.overlays as any[]).push(basemap);
                }
            }

            for (const item of profileOverlays.items) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (this.overlays as any[]).push(await Overlay.create(
                    item as ProfileOverlay,
                    {
                        skipSave: true
                    }
                ));
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (this.overlays as any[]).push(await Overlay.internal({
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
                        const sub = await this.loadMission(overlay.mode_id, {
                            reload: true
                        });

                        if (sub && overlay.active) {
                            await this.makeActiveMission(sub);
                        }
                    } catch (err) {
                        console.error('Failed to load Mission', err)
                        // TODO: Handle this gracefully
                        // The Mission Sync is either:
                        // - Deleted
                        // - Part of a channel that is no longer active
                        overlay._error = err instanceof Error ? err : new Error(String(err));
                    }
                }
            }

            this.isLoaded = true;

            await this.updateAttribution();
        },
        updateIconRotation: function(enabled: boolean): void {
            for (const overlay of this.overlays) {
                if (overlay.type === 'geojson') {
                    // Update icon rotation
                    const iconLayerId = `${overlay.id}-icon`;
                    if (this.map.getLayer(iconLayerId)) {
                        this.map.setLayoutProperty(iconLayerId, 'icon-rotate', enabled ? ['get', 'course'] : 0);
                    }

                    // Update course arrow filter based on rotation setting
                    const courseLayerId = `${overlay.id}-course`;
                    if (this.map.getLayer(courseLayerId)) {
                        if (enabled) {
                            // When rotation enabled, only show course arrows for grouped features
                            this.map.setFilter(courseLayerId, [
                                'all',
                                ['==', '$type', 'Point'],
                                ['has', 'course'],
                                ['has', 'group']
                            ]);
                        } else {
                            // When rotation disabled, show course arrows for all features with course
                            this.map.setFilter(courseLayerId, [
                                'all',
                                ['==', '$type', 'Point'],
                                ['has', 'course']
                            ]);
                        }
                    }

                    // Update text offset
                    const textLayerId = `${overlay.id}-text-point`;
                    if (this.map.getLayer(textLayerId)) {
                        this.map.setLayoutProperty(textLayerId, 'text-offset', [0, enabled ? 2 : 2.5]);
                    }
                }
            }

            // Force a map repaint to ensure changes are visible immediately
            this.map.triggerRepaint();
        },
        updateDistanceUnit: function(unit: string): void {
            this.distanceUnit = unit;
            // Remove existing scale control and add new one with correct unit
            const mapWithControl = this.map as mapgl.Map & { _scaleControl?: mapgl.ScaleControl };
            const existingControl = mapWithControl._scaleControl;
            if (existingControl) {
                this.map.removeControl(existingControl);
                const scaleControl = new mapgl.ScaleControl({
                    maxWidth: 100,
                    unit: unit === 'mile' ? 'imperial' : 'metric'
                });
                this.map.addControl(scaleControl, 'bottom-left');
                mapWithControl._scaleControl = scaleControl;
            }
        },
        updateAttribution: async function(): Promise<void> {
            const attributions: string[] = [];

            for (const overlay of this.overlays) {
                if (overlay.mode === 'basemap' && overlay.mode_id && overlay.visible) {
                    try {
                        const basemap = await std(`/api/basemap/${overlay.mode_id}`) as { attribution?: string };
                        if (basemap.attribution) {
                            attributions.push(basemap.attribution);
                        }
                    } catch (err) {
                        console.warn('Failed to load basemap attribution:', err);
                    }
                }
            }

            // Update attribution by manipulating the DOM directly
            const attributionContainer = document.querySelector('.maplibregl-ctrl-attrib-inner');
            if (attributionContainer && attributions.length > 0) {
                attributionContainer.innerHTML = attributions.join(' | ');
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

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (this.radial as any).cot = feat;
            this.radial.mode = opts.mode;

            if (feat.properties && feat.properties.center) {
                if (typeof feat.properties.center === 'string') {
                    const parts = JSON.parse(feat.properties.center);
                    this.radial.lngLat = new mapgl.LngLat(parts[0], parts[1]);
                } else {
                    this.radial.lngLat = mapgl.LngLat.convert(feat.properties.center as LngLatLike);
                }
            } else {
                this.radial.lngLat = opts.lngLat;
            }
        }
    }
})
