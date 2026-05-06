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
import BottomBarManager from './modules/bottombar.ts';
import { usePermissionStore } from './modules/permissions.ts';
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
import ProfileConfig from '../base/profile.ts';
import Config from '../base/config.ts';
import {
    clearLocationWatch,
    clearOrientationWatch,
    supportsLocationRequests,
    watchLocation,
    watchOrientation
} from '../base/capacitor.ts';

import type { ProfileOverlay, ProfileOverlayList, Basemap, APIList, Feature, ConfigMap } from '../types.ts';
import type { LngLat, LngLatLike, Point, MapMouseEvent, MapTouchEvent, MapGeoJSONFeature, GeoJSONSource } from 'maplibre-gl';
import type { PluginListenerHandle } from '@capacitor/core';
import type { CallbackID } from '@capacitor/geolocation';

export type TAKNotification = { type: string; name: string; body: string; url: string; created: string; }

export const useMapStore = defineStore('cloudtak', {
    state: (): {
        _map?: mapgl.Map;
        _draw?: DrawTool;
        _icons?: IconManager;
        _menu?: unknown;
        _bottomBar?: unknown;

        _boundOnOnline?: () => void;
        _boundOnOffline?: () => void;
        _orientationListener?: PluginListenerHandle | null;
        _boundOnVisibilityChange?: () => Promise<void>;

        db: DatabaseType;
        channel: BroadcastChannel;

        toImport: Feature[]

        // Lock the map view to a given CoT - The last element is the currently locked value
        // this is an array so that things like the radial menu can temporarily lock state but remember the previous lock value when they are closed
        locked: Array<string>;

        callsign: string;
        zoom: string;
        location: LocationState;
        locationAccuracy: number | undefined;
        gpsCoordinates: { lat: number; lng: number } | null;
        distanceUnit: string;
        coordFormat: string;
        defaultPointType: string;
        manualLocationMode: boolean;
        isMobileDetected: boolean;
        gpsWatchId: CallbackID | null;
        tokenExpiry: number | null;
        lastUpdateCOTErrorSignature: string | null;

        toastOffset: {
            x: number;
            y: number;
        };

        timer: ReturnType<typeof setInterval> | null;

        _rawWorker: Worker;
        worker: Comlink.Remote<Atlas>;
        mission: Subscription | undefined;
        mapConfig: ConfigMap;
        container?: HTMLElement;
        hasTerrain: boolean;
        hasSnapping: boolean;
        hasNoChannels: boolean;
        isTerrainEnabled: boolean;
        isLoaded: boolean;
        isOpen: boolean;
        isOnline: boolean;
        userOrientationMode: boolean;
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
        viewedFeature?: Feature | MapGeoJSONFeature,
        radial: {
            mode: string | undefined;
            cot: Feature | MapGeoJSONFeature | undefined;
            x: number;
            y: number;
            lngLat?: LngLat;
        },
        overlays: Array<Overlay>
    } => {
        const rawWorker = new Worker(AtlasWorker, { type: 'module' });
        const worker = Comlink.wrap<Atlas>(rawWorker);

        new CloudTAKTransferHandler(
            Comlink.transferHandlers,
            true
        );

        return {
            _rawWorker: rawWorker,
            worker,
            _bottomBar: markRaw(new BottomBarManager()),
            timer: null,
            callsign: 'Unknown',
            toImport: [],
            location: LocationState.Loading,
            locationAccuracy: undefined,
            gpsCoordinates: null,
            hasSnapping: false,
            db,
            channel: new BroadcastChannel("cloudtak"),
            zoom: 'conditional',
            distanceUnit: 'meter',
            coordFormat: 'dd',
            defaultPointType: 'u-d-p',
            toastOffset: { x: 70, y: 60 },
            manualLocationMode: false,
            gpsWatchId: null,
            tokenExpiry: null,
            lastUpdateCOTErrorSignature: null,
            isMobileDetected: false,
            locked: [],
            hasTerrain: false,
            hasNoChannels: false,
            isTerrainEnabled: false,
            isOpen: false,
            isLoaded: false,
            isOnline: navigator.onLine,
            userOrientationMode: false,
            pitch: 0,
            bearing: 0,
            mission: undefined,
            select: {
                mode: undefined,
                feats: [],
                x: 0, y: 0,
            },
            mapConfig: {
                center: '-100,40',
                zoom: 4,
                pitch: 0,
                bearing: 0,
                basemap: null
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
        },
        bottomBar: function(): BottomBarManager {
            if (!this._bottomBar) throw new Error('BottomBar Manager has not yet initialized');
            return this._bottomBar as BottomBarManager;
        }
    },
    actions: {
        destroy: async function() {
            // Capture current worker instances to avoid races with $reset()/state() creating new ones.
            const currentWorker = this.worker;
            const currentRawWorker = this._rawWorker;
            const permissionStore = usePermissionStore();

            if (this.timer) {
                window.clearInterval(this.timer);
            }

            if (currentWorker && currentRawWorker) {
                try {
                    await currentWorker.destroy();
                } catch (err: unknown) {
                    console.error('Failed to destroy atlas worker:', err);
                } finally {
                    try {
                        currentRawWorker.terminate();
                    } catch (terminateErr) {
                        console.error('Failed to terminate atlas worker:', terminateErr);
                    }
                }
            }

            this.channel.close();

            await permissionStore.releaseWakeLockSentinel();

            if (this._boundOnOnline) window.removeEventListener('online', this._boundOnOnline);
            if (this._boundOnOffline) window.removeEventListener('offline', this._boundOnOffline);
            if (this._orientationListener) {
                await clearOrientationWatch(this._orientationListener);
                this._orientationListener = null;
            }
            if (this._boundOnVisibilityChange) document.removeEventListener('visibilitychange', this._boundOnVisibilityChange);

            await this.stopGPSWatch();

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
        getOverlayBeforeId: function(): string | undefined {
            if (this.overlays.length > 1 && this.overlays[1].styles.length > 0) {
                return String(this.overlays[1].styles[0].id);
            }
            return undefined;
        },
        addOverlay: function(overlay: Overlay): void {
            if (this.overlays.length > 0) {
                (this.overlays as unknown as Overlay[]).splice(1, 0, overlay);
            } else {
                (this.overlays as unknown as Overlay[]).push(overlay);
            }
        },
        removeOverlay: async function(overlay: Overlay) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pos = (this.overlays as any[]).indexOf(overlay)
            if (pos === -1) return;

            this.overlays.splice(pos, 1)

            await overlay.delete();
            if (overlay.mode === 'mission' && overlay.mode_id) {
                if (this.mission && this.mission.guid === overlay.mode_id) {
                    await this.makeActiveMission(undefined);
                }

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
            burl.searchParams.set('type', 'raster-dem');
            burl.searchParams.set('limit', '1');
            const basemaps = await std(burl) as APIList<Basemap>;

            return basemaps;
        },

        // TODO: Convert to overlay
        addTerrain: async function(): Promise<void> {
            const basemaps = await this.listTerrain();
            if (basemaps.items.length && !this.map.getSource('-2')) {
                this.map.addSource('-2', {
                    type: 'raster-dem',
                    url: String(stdurl(`/api/basemap/${basemaps.items[0].id}/tiles?token=${localStorage.token}`))
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
                const addCount = diff.add?.length || 0;
                const removeCount = diff.remove?.length || 0;
                const updateCount = diff.update?.length || 0;
                const hasChanges = addCount || removeCount || updateCount;

                if (hasChanges) {
                    const invalidRemoveIds = (diff.remove || []).filter((id) => {
                        return typeof id !== 'number' || !Number.isFinite(id);
                    });
                    const invalidAddIds = (diff.add || []).filter((feature) => {
                        return typeof feature.id !== 'number' || !Number.isFinite(feature.id);
                    }).map((feature) => feature.id);
                    const invalidUpdateIds = (diff.update || []).filter((update) => {
                        return typeof update.id !== 'number' || !Number.isFinite(update.id);
                    }).map((update) => update.id);

                    const addIds = (diff.add || []).map((feature) => feature.id).filter((id): id is number => {
                        return typeof id === 'number' && Number.isFinite(id);
                    });
                    const updateIds = (diff.update || []).map((update) => update.id).filter((id): id is number => {
                        return typeof id === 'number' && Number.isFinite(id);
                    });

                    const duplicateAddIds = addIds.filter((id, index) => addIds.indexOf(id) !== index);
                    const duplicateUpdateIds = updateIds.filter((id, index) => updateIds.indexOf(id) !== index);

                    const diffSummary = {
                        addCount,
                        removeCount,
                        updateCount,
                        invalidRemoveIds: invalidRemoveIds.slice(0, 10),
                        invalidAddIds: invalidAddIds.slice(0, 10),
                        invalidUpdateIds: invalidUpdateIds.slice(0, 10),
                        duplicateAddIds: duplicateAddIds.slice(0, 10),
                        duplicateUpdateIds: duplicateUpdateIds.slice(0, 10),
                        sampleAddIds: addIds.slice(0, 10),
                        sampleRemoveIds: (diff.remove || []).slice(0, 10),
                        sampleUpdateIds: updateIds.slice(0, 10)
                    };

                    const source = this.map.getSource('-1') as GeoJSONSource | undefined;
                    if (!source) {
                        const signature = JSON.stringify({
                            kind: 'missing-source',
                            ...diffSummary
                        });

                        if (this.lastUpdateCOTErrorSignature !== signature) {
                            this.lastUpdateCOTErrorSignature = signature;
                            console.error('updateCOT could not find GeoJSON source', diffSummary);
                        }

                        return;
                    }

                    if (
                        invalidRemoveIds.length
                        || invalidAddIds.length
                        || invalidUpdateIds.length
                    ) {
                        const signature = JSON.stringify({
                            kind: 'invalid-diff',
                            ...diffSummary
                        });

                        if (this.lastUpdateCOTErrorSignature !== signature) {
                            this.lastUpdateCOTErrorSignature = signature;
                            console.error('updateCOT generated an invalid GeoJSON diff', diffSummary);
                        }

                        return;
                    }

                    try {
                        source.updateData(diff);
                    } catch (error) {
                        const signature = JSON.stringify({
                            kind: 'updateData-throw',
                            ...diffSummary
                        });

                        if (this.lastUpdateCOTErrorSignature !== signature) {
                            this.lastUpdateCOTErrorSignature = signature;
                            console.error('GeoJSON source updateData failed in updateCOT', {
                                ...diffSummary,
                                error
                            });
                        }
                    }
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

                this.lastUpdateCOTErrorSignature = null;
            } catch (err) {
                console.error('updateCOT failed before source update', err);
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

            this.isOnline = navigator.onLine;
            this._boundOnOnline = (): void => { this.isOnline = true; };
            this._boundOnOffline = (): void => { this.isOnline = false; };
            this._orientationListener = await watchOrientation((event): void => {
                if (!this.userOrientationMode) return;

                let heading: number | null = null;
                if (event.webkitCompassHeading !== undefined) {
                    heading = event.webkitCompassHeading;
                } else if (event.alpha !== null) {
                    heading = 360 - event.alpha;
                }

                if (heading !== null && this._map) {
                    this._map.setBearing(heading);
                }
            });
            this._boundOnVisibilityChange = async (): Promise<void> => {
                if (document.hidden) return;
                if (!(await this.worker.initialized)) return;

                const isOpen = await this.worker.conn.isOpen;
                if (!isOpen) {
                    console.log('Tab became visible with closed connection, reconnecting...');
                    await this.worker.conn.reconnect(await this.worker.username);
                }

                await this.updateCOT();
            };

            window.addEventListener('online', this._boundOnOnline);
            window.addEventListener('offline', this._boundOnOffline);
            document.addEventListener('visibilitychange', this._boundOnVisibilityChange);

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
                    if (this.location !== LocationState.Live) {
                        this.locationAccuracy = undefined;
                    }
                } else if (msg.type === WorkerMessageType.Profile_Location_Coordinates) {
                    this.locationAccuracy = msg.body.accuracy;
                    if (msg.body.coordinates) {
                        this.gpsCoordinates = {
                            lng: msg.body.coordinates[0],
                            lat: msg.body.coordinates[1]
                        };
                    }
                    if (!this.manualLocationMode) {
                        this.location = LocationState.Live;
                    }
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
                }
            }

            const permissionStore = usePermissionStore();
            let startedGPSWatchFromPermissionSubscription = false;
            await permissionStore.initializePermissionSubscriptions(() => {
                startedGPSWatchFromPermissionSubscription = true;
                void this.startGPSWatch();
            });

            if (
                permissionStore.permissions.location !== 'unsupported'
                && !startedGPSWatchFromPermissionSubscription
            ) {
                await this.startGPSWatch();
            }

            const sprites = IconManager.defaultSprite();

            try {
                const mapConfig = await Config.list([
                    'map::center',
                    'map::zoom',
                    'map::pitch',
                    'map::bearing',
                    'map::basemap'
                ], {
                    defaults: {
                        'map::center': '-100,40',
                        'map::zoom': 4,
                        'map::pitch': 0,
                        'map::bearing': 0,
                        'map::basemap': null
                    }
                });

                this.mapConfig = {
                    center: String(mapConfig['map::center']),
                    zoom: Number(mapConfig['map::zoom']),
                    pitch: Number(mapConfig['map::pitch']),
                    bearing: Number(mapConfig['map::bearing']),
                    basemap: mapConfig['map::basemap'] ? Number(mapConfig['map::basemap']) : null
                };
            } catch (err) {
                console.error('Failed to load map configuration, using defaults', err);

                this.mapConfig = {
                    center: '-100,40',
                    zoom: 4,
                    pitch: 0,
                    bearing: 0,
                    basemap: null
                };
            }

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
            map.addControl(scaleControl, 'bottom-right');
            (map as mapgl.Map & { _scaleControl?: mapgl.ScaleControl })._scaleControl = scaleControl;

            map.once('idle', async () => {
                const displayProjection = await ProfileConfig.get('display_projection');

                if (displayProjection && displayProjection.value === 'globe') {
                    map.setProjection({ type: "globe" });
                }

                void this.icons.hydrate()
                    .catch((error: unknown) => {
                        console.error('Failed to hydrate iconsets after map idle', error);
                    });

                await this.initOverlays();

                this.timer = setInterval(async () => {
                    if (!this.map) return;
                    await this.refresh();
                }, 500);
            });

            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore Don't remove me unless npm run doc passes
            this._map = markRaw(map);
            this._draw = new DrawTool(this);
            this._icons = markRaw(new IconManager(map, this.worker));
            this._menu = markRaw(new MenuManager(this));
            await (this._menu as MenuManager).init();
            this._bottomBar = this._bottomBar || markRaw(new BottomBarManager());

            // If we missed the initial location update make sure it gets synced
            const loc = await this.worker.profile.location;
            this.location = loc.source;
            this.locationAccuracy = loc.accuracy;
            if (loc.coordinates) {
                this.gpsCoordinates = {
                    lng: loc.coordinates[0],
                    lat: loc.coordinates[1]
                };
            }

            await this.worker.profile.load();

            this.callsign = (await ProfileConfig.get('tak_callsign'))?.value || 'Unknown';
            this.zoom = (await ProfileConfig.get('display_zoom'))?.value || 'conditional';
            this.coordFormat = (await ProfileConfig.get('display_coordinate'))?.value || 'dd';
            this.defaultPointType = (await ProfileConfig.get('tak_type'))?.value || 'u-d-p';

            const icon_rotation = (await ProfileConfig.get('display_icon_rotation'))?.value;

            // Initialize icon rotation setting after overlays are loaded
            setTimeout(() => {
                this.updateIconRotation(icon_rotation as unknown as boolean);
            }, 100);

            this.distanceUnit = (await ProfileConfig.get('display_distance'))?.value || 'meter';

            // Initialize scale control settings
            this.updateDistanceUnit(this.distanceUnit);

            this.isOpen = await this.worker.conn.isOpen;

        },
        stopGPSWatch: async function(): Promise<void> {
            if (this.gpsWatchId === null) {
                return;
            }

            const watchId = this.gpsWatchId;
            this.gpsWatchId = null;

            try {
                await clearLocationWatch(watchId);
            } catch (err) {
                console.warn('Failed to clear location watch', err);
            }
        },
        startGPSWatch: async function(): Promise<void> {
            if (!supportsLocationRequests()) return;

            await this.stopGPSWatch();

            try {
                this.gpsWatchId = await watchLocation({
                    maximumAge: 0,
                    timeout: 1500,
                    enableHighAccuracy: true
                }, (position, err) => {
                    if (err) {
                        const geolocationError = err as { code?: number };

                        if (geolocationError.code !== 0) {
                            console.error('Location Error', err);
                        }

                        return;
                    }

                    if (!position || this.manualLocationMode) {
                        return;
                    }

                    this.locationAccuracy = position.coords.accuracy;

                    this.channel.postMessage({
                        type: WorkerMessageType.Profile_Location_Coordinates,
                        body: {
                            accuracy: position.coords.accuracy,
                            altitude: position.coords.altitude,
                            coordinates: [ position.coords.longitude, position.coords.latitude ]
                        }
                    });
                });
            } catch (err) {
                console.error('Failed to start location watch', err);
            }
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
                void this.icons.onStyleImageMissing(e).catch((error: unknown) => {
                    console.error('styleimagemissing handler failed', {
                        imageId: e.id,
                        error
                    });
                });
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
                        const featId = feat.properties.id || feat.id;
                        if (!featId) continue;

                        const cot = await this.worker.db.get(String(featId), {
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
                        type: this.defaultPointType,
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

            // Long-press event handler for mobile devices
            let pressTimer: number | undefined;
            let pressEvent: MapTouchEvent | undefined;
            let pressStartPoint: Point | undefined;

            map.on('touchstart', (e) => {
                if (this.draw.editing) return;

                // Only handle single-touch (avoid interfering with multi-touch gestures like pinch-to-zoom)
                if (e.originalEvent && e.originalEvent.touches.length !== 1) return;

                // Store the event and starting point for later use
                pressEvent = e;
                pressStartPoint = e.point;

                // Set a timer for long-press detection (500ms)
                pressTimer = window.setTimeout(() => {
                    if (pressEvent) {
                        // Prevent default context menu on mobile
                        if (pressEvent.originalEvent) {
                            pressEvent.originalEvent.preventDefault();
                        }

                        const id = randomUUID();
                        this.radialClick({
                            id,
                            type: 'Feature',
                            path: '/',
                            properties: {
                                id,
                                callsign: 'New Feature',
                                archived: true,
                                type: this.defaultPointType,
                                how: 'm-g',
                                time: new Date().toISOString(),
                                start: new Date().toISOString(),
                                stale: new Date(Date.now() + 2 * (60 * 60 * 1000)).toISOString(),
                                center: [ pressEvent.lngLat.lng, pressEvent.lngLat.lat ],
                                'marker-color': '#00ff00',
                                'marker-opacity': 1
                            },
                            geometry: {
                                type: 'Point',
                                coordinates: [pressEvent.lngLat.lng, pressEvent.lngLat.lat]
                            }
                        }, {
                            mode: 'context',
                            point: pressEvent.point,
                            lngLat: pressEvent.lngLat
                        });

                        pressEvent = undefined;
                        pressStartPoint = undefined;
                    }
                }, 500);
            });

            map.on('touchend', () => {
                // Clear the timer if touch ends before long-press threshold
                if (pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = undefined;
                }
                pressEvent = undefined;
                pressStartPoint = undefined;
            });

            map.on('touchmove', (e) => {
                // Only clear if there's an active timer
                if (pressTimer && pressStartPoint) {
                    // Calculate squared distance moved from starting point (avoiding expensive sqrt)
                    const deltaX = e.point.x - pressStartPoint.x;
                    const deltaY = e.point.y - pressStartPoint.y;
                    const distanceSquared = deltaX * deltaX + deltaY * deltaY;

                    // Clear the timer if user moves more than 10 pixels (10^2 = 100)
                    // This allows for minor finger tremors while still preventing accidental triggers
                    if (distanceSquared > 100) {
                        clearTimeout(pressTimer);
                        pressTimer = undefined;
                        pressEvent = undefined;
                        pressStartPoint = undefined;
                    }
                }
            });

            const url = stdurl('/api/profile/overlay');
            url.searchParams.set('sort', 'pos');
            url.searchParams.set('order', 'asc');
            url.searchParams.set('limit', '100');
            const profileOverlays = await std(url) as ProfileOverlayList;
            this.hasTerrain = profileOverlays.available.terrain;
            this.hasSnapping = profileOverlays.available.snapping;

            const hasBasemap = profileOverlays.items.some((o: ProfileOverlay) => {
                return o.mode === 'basemap'
            });

            // Courtesy add an initial basemap
            if (!hasBasemap) {
                let defaultBasemap: Basemap | null = null;

                if (this.mapConfig.basemap) {
                    try {
                        const burl = stdurl(`/api/basemap/${this.mapConfig.basemap}`);
                        defaultBasemap = await std(burl) as Basemap;
                    } catch (err) {
                        console.warn('Failed to load configured basemap:', err);
                    }
                }

                if (!defaultBasemap) {
                    const burl = stdurl('/api/basemap');
                    burl.searchParams.set('type', 'raster');
                    const basemaps = await std(burl) as APIList<Basemap>;

                    if (basemaps.items.length > 0) {
                        defaultBasemap = basemaps.items[0];
                    }
                }

                if (defaultBasemap) {
                    // Default basemap creation hits /api/profile/overlay
                    // (POST + PATCH) and the upstream /tiles endpoint. Any
                    // of those can transiently fail; treat as non-fatal so
                    // the rest of map initialization still proceeds.
                    try {
                        const basemap = await Overlay.create({
                            name: defaultBasemap.name,
                            pos: -1,
                            type: 'raster',
                            url: String(stdurl(`/api/basemap/${defaultBasemap.id}/tiles`)),
                            mode: 'basemap',
                            mode_id: String(defaultBasemap.id)
                        });

                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (this.overlays as any[]).push(basemap);
                    } catch (err) {
                        console.error('Failed to create default basemap overlay:', err);
                    }
                }
            }

            // Parallelize Overlay Creation. Use allSettled so a single
            // overlay whose /tiles endpoint fails (404, network blip,
            // upstream outage) does not prevent every other overlay -- and
            // the rest of map init -- from completing. Failed entries are
            // logged and dropped; Overlay.init also records the error on
            // the overlay instance so the MenuOverlays UI can surface it.
            const overlayResults = await Promise.allSettled(profileOverlays.items.map(item =>
                Overlay.create(item as ProfileOverlay, { skipSave: true, skipLayers: true })
            ));

            const newOverlays: Overlay[] = [];
            for (let i = 0; i < overlayResults.length; i++) {
                const result = overlayResults[i];
                if (result.status === 'fulfilled') {
                    newOverlays.push(result.value);
                } else {
                    const item = profileOverlays.items[i];
                    console.error(`Failed to create overlay ${item?.id} (${item?.name}):`, result.reason);
                }
            }

            for (const overlay of newOverlays) {
                try {
                    await overlay.addLayers();
                } catch (err) {
                    overlay._error = err instanceof Error ? err : new Error(String(err));
                    console.error(`Failed to add layers for overlay ${overlay.id} (${overlay.name}):`, err);
                }
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (this.overlays as any[]).push(...newOverlays);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (this.overlays as any[]).push(await Overlay.internal({
                id: -1,
                name: 'Map Features',
                type: 'geojson',
            }));

            // Data Syncs are specially loaded as they are dynamic
            // Mission loading is fire-and-forget so logs/changes/features
            // do not block the rest of map initialization. Each overlay is
            // marked as `loading` while its mission data is being fetched
            // and the maplibre source/layer + overlay entry are already in
            // place from the steps above.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const missionOverlays = (this.overlays as any[]).filter((overlay: Overlay) => overlay.mode === 'mission' && overlay.mode_id);
            for (const overlay of missionOverlays) {
                const source = map.getSource(String(overlay.id));
                if (!source) continue;

                overlay.loading = true;

                this.loadMission(overlay.mode_id!, {
                    reload: true
                }).then(async (sub) => {
                    if (sub && overlay.active) {
                        await this.makeActiveMission(sub);
                    }
                }).catch((err) => {
                    console.error('Failed to load Mission', err);
                    overlay._error = err instanceof Error ? err : new Error(String(err));
                }).finally(() => {
                    overlay.loading = false;
                });
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
                this.map.addControl(scaleControl, 'bottom-right');
                mapWithControl._scaleControl = scaleControl;
            }
        },
        updateAttribution: async function(): Promise<void> {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const attributionOverlays = (this.overlays as any[]).filter((o: Overlay) => o.mode === 'basemap' && o.mode_id && o.visible);
            const attributionPromises = attributionOverlays.map(async (overlay: Overlay) => {
                    try {
                        const basemap = await std(`/api/basemap/${overlay.mode_id}`) as { attribution?: string };
                        return basemap.attribution;
                    } catch (err) {
                        console.warn('Failed to load basemap attribution:', err);
                        return null;
                    }
                });

            const results = await Promise.all(attributionPromises);
            const attributions = results.filter((a): a is string => !!a);

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

            if (feat.geometry && feat.geometry.type === 'Point' && feat.properties && feat.properties.center) {
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
