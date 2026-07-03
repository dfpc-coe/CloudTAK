/*
* MapStore - Maintain the state of the MapLibreGL Instance
*
* Terminology:
* - Overlay - The "container" that is saved in the DB that contains a reference to a single GIS source and potentially many rendered layers
* - Layer - MapLibre - Ref: https://maplibre.org/maplibre-style-spec/layers/
* - Source - MapLibre - Ref: https://maplibre.org/maplibre-style-spec/sources/
*/

import { v4 as randomUUID } from 'uuid';
import { Preferences } from '@capacitor/preferences';
import { CapacitorHttp } from '@capacitor/core';
import { defineStore } from 'pinia'
import { markRaw } from 'vue';
import DrawTool, { DrawToolMode } from './modules/draw.ts';
import IconManager from './modules/icons.ts';
import MenuManager from './modules/menu.ts';
import BottomBarManager from './modules/bottombar.ts';
import { useDeviceStore } from './device.ts';
import * as Comlink from 'comlink';
import AtlasWorker from '../workers/atlas.ts?worker&url';
import COT from '../base/cot.ts';
import GeolocateControl from '../lib/geolocate/main.ts';
import RoutingControl from '../lib/routing/main.ts';
import type { NavigationState, NavigationDirection } from '../lib/routing/main.ts';
import { syncPushToken } from '../base/push.ts';
import { WorkerMessageType, LocationState } from '../base/events.ts';
import type { WorkerMessage } from '../base/events.ts';
import Overlay from '../base/overlay-class.ts';
import OverlayManager from '../base/overlay.ts';
import { FeatureVisibility } from './modules/feature-visibility.ts';
import Subscription from '../base/subscription.ts';
import { stdurl, server, getRuntimeToken, serverUrl } from '../std.js';
import * as mapgl from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type Atlas from '../workers/atlas.ts';
import { CloudTAKTransferHandler } from '../base/handler.ts';
import ProfileConfig from '../base/profile.ts';
import Config from '../base/config.ts';
import { isNativePlatform, addBackgroundStateListener } from '../base/capacitor.ts';
import { ensureDatabase } from '../database.ts';

import type { ProfileOverlay, Basemap, Feature } from '../types.ts';
import type { LngLat, LngLatLike, Point, MapMouseEvent, MapTouchEvent, MapGeoJSONFeature, GeoJSONSource } from 'maplibre-gl';
import type { Position } from '@capacitor/geolocation';

function waitForAtlasWorkerReady(worker: Worker): Promise<void> {
    return new Promise((resolve, reject) => {
        const controller = new AbortController();

        const cleanup = () => {
            controller.abort();
        };

        worker.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
            if (event.data?.type !== WorkerMessageType.Atlas_Ready) return;

            cleanup();
            resolve();
        }, { signal: controller.signal });

        worker.addEventListener('error', (event) => {
            cleanup();
            reject(event.error instanceof Error ? event.error : new Error(event.message || 'Atlas worker failed to load'));
        }, { signal: controller.signal });

        worker.addEventListener('messageerror', () => {
            cleanup();
            reject(new Error('Atlas worker sent an unreadable startup message'));
        }, { signal: controller.signal });
    });
}

export type TAKNotification = { type: string; name: string; body: string; url: string; created: string; }

export const useMapStore = defineStore('cloudtak', {
    state: (): {
        _map?: mapgl.Map;
        _draw?: DrawTool;
        _icons?: IconManager;
        _menu?: unknown;
        _bottomBar?: unknown;

        _removeOrientationListener?: () => Promise<void>;
        _boundOnVisibilityChange?: () => Promise<void>;
        _removeBackgroundStateListener?: () => void;
        _removePushTokenListener?: () => void;

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
        gpsSpeed: number | null;
        navigation: {
            active: boolean;
            cotId: string | null;
            callsign: string | null;
            direction: NavigationDirection;
            state: NavigationState | null;
        };
        distanceUnit: string;
        coordFormat: string;
        defaultPointType: string;
        manualLocationMode: boolean;
        isBackgrounded: boolean;

        lastUpdateCOTErrorSignature: string | null;

        toastOffset: {
            x: number;
            y: number;
        };

        timer: ReturnType<typeof setInterval> | null;

        _rawWorker?: Worker;
        _workerReady?: Promise<void>;
        _worker?: Comlink.Remote<Atlas>;
        mission: Subscription | undefined;
        terrainEnabled: boolean;
        container?: HTMLElement;
        hasSnapping: boolean;
        hasNoChannels: boolean;
        channelChange: boolean;
        isLoaded: boolean;
        isOpen: boolean;
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
        }
    } => {
        return {
            _rawWorker: undefined,
            _workerReady: undefined,
            _worker: undefined,
            _bottomBar: markRaw(new BottomBarManager()),
            timer: null,
            callsign: 'Unknown',
            toImport: [],
            location: LocationState.Loading,
            locationAccuracy: undefined,
            gpsCoordinates: null,
            gpsSpeed: null,
            navigation: {
                active: false,
                cotId: null,
                callsign: null,
                direction: 'forward',
                state: null
            },
            hasSnapping: false,
            channel: markRaw(new BroadcastChannel("cloudtak")),
            zoom: 'conditional',
            distanceUnit: 'meter',
            coordFormat: 'dd',
            defaultPointType: 'u-d-p',
            toastOffset: { x: 70, y: 60 },
            manualLocationMode: false,

            lastUpdateCOTErrorSignature: null,
            isBackgrounded: false,
            locked: [],
            terrainEnabled: false,
            hasNoChannels: false,
            channelChange: false,
            isOpen: false,
            isLoaded: false,
            userOrientationMode: false,
            pitch: 0,
            bearing: 0,
            mission: undefined,
            select: {
                mode: undefined,
                feats: [],
                x: 0, y: 0,
            },
            radial: {
                mode: undefined,
                cot: undefined,
                x: 0, y: 0,
                lngLat: undefined
            },

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
        },
        worker: function(): Comlink.Remote<Atlas> {
            if (!this._worker) throw new Error('Atlas worker has not yet started');
            return this._worker as Comlink.Remote<Atlas>;
        }
    },
    actions: {
        startLocationWatch: async function() {
            const deviceStore = useDeviceStore();
            await deviceStore.geolocation.startWatch((position: Position) => {
                if (this.manualLocationMode) return;

                this.locationAccuracy = position.coords.accuracy;
                this.gpsCoordinates = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                this.gpsSpeed = typeof position.coords.speed === 'number' && !Number.isNaN(position.coords.speed)
                    ? position.coords.speed
                    : null;
                this.syncRoutingControl();

                try {
                    this.channel.postMessage({
                        type: WorkerMessageType.Profile_Location_Coordinates,
                        body: {
                            accuracy: position.coords.accuracy,
                            altitude: position.coords.altitude,
                            altitudeAccuracy: position.coords.altitudeAccuracy,
                            speed: position.coords.speed,
                            heading: position.coords.heading,
                            timestamp: position.timestamp,
                            coordinates: [ position.coords.longitude, position.coords.latitude ]
                        }
                    });
                } catch (err) {
                    // channel may be closed during teardown
                    console.error(err);
                }

                if (isNativePlatform() && this.isBackgrounded) {
                    void this.submitLocationHttp(position);
                }
            });
        },
        syncGeolocateControl: function() {
            if (!this._map) return;

            const control = (this._map as mapgl.Map & { _geolocateControl?: GeolocateControl })._geolocateControl;
            if (!control) return;

            if (this.location === LocationState.Disabled || !this.gpsCoordinates) {
                control.setLocation(null);
            } else {
                const accuracy = this.location === LocationState.Preset ? 0 : this.locationAccuracy;
                control.setLocation(this.gpsCoordinates, accuracy);
            }
        },
        routingControl: function(): RoutingControl | undefined {
            if (!this._map) return undefined;
            return (this._map as mapgl.Map & { _routingControl?: RoutingControl })._routingControl;
        },
        syncRoutingControl: function() {
            if (!this.navigation.active) return;

            const control = this.routingControl();
            if (!control) return;

            if (this.location === LocationState.Disabled || !this.gpsCoordinates) {
                control.setLocation(null);
            } else {
                control.setLocation(this.gpsCoordinates);
            }
        },
        startNavigation: async function(cotId: string) {
            const control = this.routingControl();
            if (!control) return;

            const cot = await this.worker.db.get(cotId);
            if (!cot) throw new Error('Unable to load Route for navigation');

            if (!cot.is_route) {
                throw new Error('Navigation is only supported for Route (b-m-r LineString) features');
            }

            const feature = cot.as_feature();

            control.setRoute({
                type: 'Feature',
                properties: {},
                geometry: feature.geometry as import('geojson').LineString
            });

            this.navigation.active = true;
            this.navigation.cotId = cotId;
            this.navigation.callsign = feature.properties.callsign || 'Route';
            this.navigation.direction = control.getDirection();

            this.syncRoutingControl();
        },
        stopNavigation: function() {
            const control = this.routingControl();
            if (control) control.setRoute(null);

            this.navigation.active = false;
            this.navigation.cotId = null;
            this.navigation.callsign = null;
            this.navigation.direction = 'forward';
            this.navigation.state = null;
        },
        reverseNavigation: function() {
            const control = this.routingControl();
            if (!control || !this.navigation.active) return;

            control.reverse();
            this.navigation.direction = control.getDirection();
        },
        openSelfFeature: async function() {
            try {
                if (!this._map || !this.gpsCoordinates) return;

                const uid = await this.worker.profile.uid();
                if (!uid) return;

                const cot = await this.worker.db.get(uid);
                if (!cot) return;

                // Mirror a normal CoT marker click so the puck opens the same
                // radial menu (mode 'cot') rather than the CoTView sidebar.
                const lngLat = new mapgl.LngLat(this.gpsCoordinates.lng, this.gpsCoordinates.lat);
                await this.radialClick(cot.as_feature(), {
                    lngLat,
                    point: this.map.project(lngLat),
                    mode: 'cot'
                });
            } catch (err) {
                console.error('Failed to open self location radial menu', err);
            }
        },
        startWorker: function() {
            if (this._rawWorker) return;

            const rawWorker = new Worker(AtlasWorker, { type: 'module' });

            new CloudTAKTransferHandler(
                Comlink.transferHandlers,
                true
            );

            this._rawWorker = markRaw(rawWorker);
            this._workerReady = waitForAtlasWorkerReady(rawWorker);
            this._worker = markRaw(Comlink.wrap<Atlas>(rawWorker));
        },
        destroy: async function() {
            // Capture current worker instances to avoid races with $reset()/state() creating new ones.
            const currentWorker = this._worker;
            const currentRawWorker = this._rawWorker;
            const deviceStore = useDeviceStore();

            if (this.timer) {
                window.clearInterval(this.timer);
            }

            // Stop geolocation watch first so no callbacks fire during async teardown below
            await deviceStore.geolocation.stopWatch();

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

            try {
                this.channel.close();
            } catch (err) {
                // channel may already be closed
                console.error(err);
            }

            await deviceStore.wakeLock.releaseSentinel();

            if (this._removeOrientationListener) {
                await this._removeOrientationListener();
                this._removeOrientationListener = undefined;
            }
            if (this._boundOnVisibilityChange) document.removeEventListener('visibilitychange', this._boundOnVisibilityChange);
            if (this._removeBackgroundStateListener) {
                this._removeBackgroundStateListener();
                this._removeBackgroundStateListener = undefined;
            }
            if (this._removePushTokenListener) {
                this._removePushTokenListener();
                this._removePushTokenListener = undefined;
            }

            if (this._map) {
                try {
                    this._map.remove();
                    delete this._map;
                } catch (err) {
                    console.error(err);
                }
            }
            OverlayManager.clearLoaded();
            this.$reset();
        },
        makeActiveMission: async function(mission?: Subscription): Promise<void> {
            this.mission = mission ? markRaw(mission) : undefined;
            await this.worker.db.makeActiveMission(mission ? mission.meta.guid : undefined);

            if (mission) {
                for (const overlay of OverlayManager.missionOverlays()) {
                    if (overlay.mode_id !== mission.meta.guid && overlay.active) {
                        // The API call to make active will disable all active overlays on the backend so no need for networkIO
                        overlay.active = false;
                    } else if (overlay.mode_id === mission.meta.guid) {
                        overlay.active = true;

                        await overlay.save();
                    }
                }
            } else {
                for (const overlay of OverlayManager.missionOverlays()) {
                    if (overlay.active) {
                        overlay.active = false;
                        await overlay.save();
                    }
                }
            }
        },
        // TODO: Convert to overlay
        addTerrain: async function(): Promise<void> {
            const cfg = await Config.list(['map::terrain'], { defaults: { 'map::terrain': null } });
            const terrainId = cfg['map::terrain'] ? Number(cfg['map::terrain']) : null;
            if (!terrainId) return;
            if (this.map.getSource('-2')) return;

            const terrainRes = await server.GET('/api/basemap/{:basemapid}', {
                params: { path: { ':basemapid': terrainId } }
            });
            if (terrainRes.error) throw new Error(terrainRes.error.message);
            const terrain = terrainRes.data as Basemap;

            if (terrain.type !== 'raster-dem') {
                throw new Error(`Terrain basemap ${terrainId} is not a raster-dem type`);
            }

            const { value: token } = await Preferences.get({ key: 'token' });
            const terrainUrl = stdurl(`/api/basemap/${terrain.id}/tiles`);
            if (token) terrainUrl.searchParams.set('token', token);

            const source: { type: 'raster-dem'; url: string; tileSize?: number; encoding?: 'mapbox' | 'terrarium' } = {
                type: 'raster-dem',
                url: String(terrainUrl)
            };

            if (terrain.tilesize) source.tileSize = terrain.tilesize;
            if (terrain.encoding) source.encoding = terrain.encoding;

            this.map.addSource('-2', source);

            this.map.setTerrain({
                source: '-2',
                exaggeration: 1.5
            });

            this.terrainEnabled = true;

            if (this.map.getPitch() === 0) {
                this.map.easeTo({ pitch: 45 });
            }
        },

        removeTerrain: function(): void {
            this.map.setTerrain(null);
            this.map.removeSource('-2');

            this.terrainEnabled = false;

            this.map.easeTo({ pitch: 0 });
        },

        returnHome: async function(): Promise<void> {
            const cfg = await Config.list(
                ['map::center', 'map::zoom', 'map::pitch', 'map::bearing'],
                { defaults: { 'map::center': '-100,40', 'map::zoom': 4, 'map::pitch': 0, 'map::bearing': 0 } }
            );
            this.map.flyTo({
                zoom: Number(cfg['map::zoom']),
                pitch: Number(cfg['map::pitch']),
                bearing: Number(cfg['map::bearing']),
                center: String(cfg['map::center']).split(',').map(Number) as LngLatLike,
                speed: Infinity
            });
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
            const overlay = OverlayManager.loadedByMode('mission', guid)
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

            const { value: token } = await Preferences.get({ key: 'token' });

            let sub: Subscription | null = null;
            if (!opts?.reload) {
                sub = (await Subscription.from(guid, token || '', { subscribed: true })) || null;
            }

            if (!sub) {
                sub = await Subscription.load(guid, {
                    token: token || '',
                    reload: opts?.reload || false,
                    subscribed: true,
                    missiontoken: overlay.token || undefined
                });
            }

            // @ts-expect-error Source.setData is not defined
            oStore.setData(await sub.feature.collection(false));

            if (sub.dirty) {
                await sub.update({ dirty: false });
            }

            return sub;
        },
        init: async function(container: HTMLElement) {
            // Start the worker here rather than in state() so that std.ts
            // inside the worker resolves serverUrl from KV only after
            // initializeApp() has written it — eliminating the race that
            // caused the worker to fall back to capacitor://localhost.
            this.startWorker();

            const deviceStore = useDeviceStore();

            this.container = container;

            this._boundOnVisibilityChange = async (): Promise<void> => {
                if (document.hidden) return;
                if (!(await this.worker.initialized)) return;

                // Proactively reopen the main-thread IndexedDB connection.
                // WebKit may have force-closed it while the app was backgrounded.
                try {
                    await ensureDatabase();
                } catch (err) {
                    console.error('Failed to reopen IndexedDB on resume:', err);
                }

                const isOpen = await this.worker.conn.isOpen;
                if (!isOpen) {
                    console.log('Tab became visible with closed connection, reconnecting...');
                    await this.worker.conn.reconnect(await this.worker.username);
                }

                await this.updateCOT();
            };

            this._removeOrientationListener = await deviceStore.orientation.addListener((heading) => {
                // Drive the self-location puck's heading cone regardless of
                // whether the map itself is being rotated to match.
                const control = this._map
                    ? (this._map as mapgl.Map & { _geolocateControl?: GeolocateControl })._geolocateControl
                    : undefined;
                if (control) control.setHeading(heading);

                if (this.userOrientationMode && heading !== null && this._map) {
                    this.map.setBearing(heading);
                }
            });
            document.addEventListener('visibilitychange', this._boundOnVisibilityChange);

            // Track foreground/background transitions using a native-reliable
            // signal so background location reporting (submitLocationHttp) is
            // gated correctly on iOS, where document.hidden is unreliable.
            this.isBackgrounded = false;
            this._removeBackgroundStateListener = await addBackgroundStateListener((isBackgrounded) => {
                this.isBackgrounded = isBackgrounded;
            });

            const { value: token } = await Preferences.get({ key: 'token' });

            await this._workerReady!;
            await this.worker.init(token || '');

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
                    this.syncGeolocateControl();
                    this.syncRoutingControl();
                } else if (msg.type === WorkerMessageType.Profile_Location_Coordinates) {
                    this.locationAccuracy = msg.body.accuracy;
                    this.gpsSpeed = typeof msg.body.speed === 'number' && !Number.isNaN(msg.body.speed)
                        ? msg.body.speed
                        : null;
                    if (msg.body.coordinates) {
                        this.gpsCoordinates = {
                            lng: msg.body.coordinates[0],
                            lat: msg.body.coordinates[1]
                        };
                    }
                    if (!this.manualLocationMode && this.location !== LocationState.Preset) {
                        this.location = LocationState.Live;
                    }
                    this.syncGeolocateControl();
                    this.syncRoutingControl();
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
                } else if (msg.type === WorkerMessageType.Channel_Change) {
                    this.channelChange = true;
                } else if (msg.type === WorkerMessageType.Mission_Change_Feature) {
                    await this.loadMission(msg.body.guid);
                } else if (msg.type === WorkerMessageType.Sync_Update) {
                    const event = msg.body as { type: string; action: string; id?: string | number };

                    // Another connected client mutated overlays - the Atlas
                    // worker has already refreshed the local database, so
                    // reconcile the loaded map overlays against it
                    if (['overlay', 'mission', 'basemap'].includes(event.type)) {
                        await this.reconcileOverlays();
                    }
                }
            }

            let startedGPSWatchFromPermissionSubscription = false;

            await deviceStore.initializePermissionSubscriptions(() => {
                startedGPSWatchFromPermissionSubscription = true;
                void this.startLocationWatch();
            });

            // Keep this device's push notification registration in sync. The
            // device store already obtained the current token during
            // initialization (when permission is granted) and emits future
            // rotations via `onMessagingToken`. Store the unsubscribe handle so
            // destroy() can remove it and avoid accumulating listeners across
            // mount/unmount cycles.
            if (this._removePushTokenListener) this._removePushTokenListener();
            this._removePushTokenListener = deviceStore.onMessagingToken((token) => {
                void syncPushToken(token);
            });
            void syncPushToken(deviceStore.getMessagingToken());

            if (
                deviceStore.permissions.location !== 'unsupported'
                && !startedGPSWatchFromPermissionSubscription
            ) {
                await this.startLocationWatch();
            }

            const sprites = IconManager.defaultSprite();

            let initCenter = '-100,40';
            let initZoom = 4;
            let initPitch = 0;
            let initBearing = 0;

            try {
                const cfg = await Config.list([
                    'map::center',
                    'map::zoom',
                    'map::pitch',
                    'map::bearing',
                    'map::basemap',
                    'map::terrain'
                ], {
                    defaults: {
                        'map::center': '-100,40',
                        'map::zoom': 4,
                        'map::pitch': 0,
                        'map::bearing': 0,
                        'map::basemap': null,
                        'map::terrain': null
                    }
                });

                initCenter = String(cfg['map::center']);
                initZoom = Number(cfg['map::zoom']);
                initPitch = Number(cfg['map::pitch']);
                initBearing = Number(cfg['map::bearing']);
            } catch (err) {
                console.error('Failed to load map configuration, using defaults', err);
            }

            const glyphs = `${String(stdurl('/api/fonts'))}/{fontstack}/{range}.pbf${token ? `?token=${encodeURIComponent(token)}` : ''}`;

            const init: mapgl.MapOptions = {
                container: this.container,
                hash: true,
                attributionControl: {},
                fadeDuration: 0,
                zoom: initZoom,
                pitch: initPitch,
                bearing: initBearing,
                center: initCenter.split(',').map(Number) as LngLatLike,
                maxPitch: 85,
                style: {
                    version: 8,
                    glyphs,
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

            mapgl.setWorkerUrl(maplibreWorkerUrl);
            const map = new mapgl.Map(init);

            // Add scale control
            const scaleControl = new mapgl.ScaleControl({
                maxWidth: 100,
                unit: 'metric'
            });
            map.addControl(scaleControl, 'bottom-right');
            (map as mapgl.Map & { _scaleControl?: mapgl.ScaleControl })._scaleControl = scaleControl;

            // Add the self-location puck control. Position/accuracy/heading are
            // fed from the existing location pipeline (see syncGeolocateControl
            // and the device orientation handler). The puck is non-interactive;
            // recentring on the user's location is handled by the BottomBar
            // callsign control.
            const geolocateControl = new GeolocateControl({
                onClick: () => {
                    void this.openSelfFeature();
                }
            });
            map.addControl(geolocateControl, 'top-right');
            (map as mapgl.Map & { _geolocateControl?: GeolocateControl })._geolocateControl = geolocateControl;

            // Add the route-navigation control. Renders guidance (connector +
            // remaining-segment highlight) along an active TAK Route. Position is
            // fed from the same location pipeline via syncRoutingControl().
            const routingControl = new RoutingControl({
                onUpdate: (state) => {
                    this.navigation.state = state;
                }
            });
            map.addControl(routingControl);
            (map as mapgl.Map & { _routingControl?: RoutingControl })._routingControl = routingControl;

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
            this._draw = markRaw(new DrawTool(this));
            this._icons = markRaw(new IconManager(map));
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
            this.syncGeolocateControl();

            await this.worker.profile.load();

            this.callsign = (await ProfileConfig.get('tak_callsign'))?.value || 'Unknown';
            this.zoom = (await ProfileConfig.get('display_zoom'))?.value || 'conditional';
            this.coordFormat = (await ProfileConfig.get('display_coordinate'))?.value || 'dd';
            this.defaultPointType = (await ProfileConfig.get('tak_type'))?.value || 'u-d-p';

            // Colour the self-location puck with the user's TAK team colour to
            // match the previously rendered self CoT marker.
            const takGroup = (await ProfileConfig.get('tak_group'))?.value;
            const puckControl = (this._map as mapgl.Map & { _geolocateControl?: GeolocateControl })._geolocateControl;
            if (puckControl) puckControl.setTeam(typeof takGroup === 'string' ? takGroup : undefined);

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

        submitLocationHttp: async function(position: Position): Promise<void> {
            try {
                const body = {
                    longitude: position.coords.longitude,
                    latitude: position.coords.latitude,
                    ...(position.coords.altitude !== null ? { altitude: position.coords.altitude } : {}),
                    accuracy: position.coords.accuracy,
                    ...(position.coords.altitudeAccuracy !== null ? { altitudeAccuracy: position.coords.altitudeAccuracy } : {}),
                    ...(position.coords.speed !== null ? { speed: position.coords.speed } : {}),
                    ...(position.coords.heading !== null ? { bearing: position.coords.heading } : {}),
                    time: position.timestamp,
                };

                // Use CapacitorHttp for native background requests to avoid WebView throttling
                if (isNativePlatform()) {
                    const token = await getRuntimeToken();
                    await CapacitorHttp.put({
                        url: `${serverUrl}/api/profile/location`,
                        headers: {
                            'Content-Type': 'application/json',
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        },
                        data: body
                    });
                } else {
                    await server.PUT('/api/profile/location', { body });
                }
            } catch (err) {
                console.warn('Failed to submit background location via HTTP', err);
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
                const clickMap = OverlayManager.clickableLayerMap();

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
                        'marker-color': this.defaultPointType === 'u-d-p' ? '#00ff00' : undefined,
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

            OverlayManager.clearLoaded();
            const profileOverlays = await OverlayManager.list({ localFirst: true });

            await FeatureVisibility.load();

            const hasBasemap = profileOverlays.some((o: ProfileOverlay) => {
                return o.mode === 'basemap'
            });

            // Courtesy add an initial basemap
            if (!hasBasemap) {
                let defaultBasemap: Basemap | null = null;

                const basemapCfg = await Config.list(['map::basemap'], { defaults: { 'map::basemap': null } });
                const basemapId = basemapCfg['map::basemap'] ? Number(basemapCfg['map::basemap']) : null;

                if (basemapId) {
                    try {
                        const basemapRes = await server.GET('/api/basemap/{:basemapid}', {
                            params: { path: { ':basemapid': basemapId } }
                        });
                        if (basemapRes.error) throw new Error(basemapRes.error.message);
                        defaultBasemap = basemapRes.data as Basemap;
                    } catch (err) {
                        console.warn('Failed to load configured basemap:', err);
                    }
                }

                if (!defaultBasemap) {
                    const basemapsRes = await server.GET('/api/basemap', {
                        params: { query: { type: 'raster', limit: 1, page: 0, order: 'asc', sort: 'name', filter: '', overlay: false, hidden: 'false' } }
                    });
                    if (basemapsRes.error) throw new Error(basemapsRes.error.message);

                    if (basemapsRes.data.items.length > 0) {
                        defaultBasemap = basemapsRes.data.items[0] as Basemap;
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

                        OverlayManager.appendLoaded(basemap);
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
            const overlayResults = await Promise.allSettled(profileOverlays.map(item =>
                Overlay.create(item as ProfileOverlay, { skipSave: true, skipLayers: true })
            ));

            const newOverlays: Overlay[] = [];
            for (let i = 0; i < overlayResults.length; i++) {
                const result = overlayResults[i];
                if (result.status === 'fulfilled') {
                    newOverlays.push(result.value);
                } else {
                    const item = profileOverlays[i];
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

            OverlayManager.appendLoaded(...newOverlays);

            OverlayManager.appendLoaded(await Overlay.internal({
                id: -1,
                name: 'Map Features',
                type: 'geojson',
            }));

            await FeatureVisibility.apply();

            // Data Syncs are specially loaded as they are dynamic
            // Mission loading is fire-and-forget so logs/changes/features
            // do not block the rest of map initialization. Each overlay is
            // marked as `loading` while its mission data is being fetched
            // and the maplibre source/layer + overlay entry are already in
            // place from the steps above.
            for (const overlay of OverlayManager.missionOverlays()) {
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

            // Map is initialized & loaded - kick off a full data type
            // synchronization with the TAK Server in the Atlas worker
            this.worker.sync.start()
                .catch((err: unknown) => {
                    console.error('Failed to perform full sync after map load', err);
                });

            await this.updateAttribution();
        },

        /**
         * Reconcile the loaded map overlays against the local overlay
         * database after a sync triggered by another of the user's connected
         * clients. Adds newly created overlays, removes deleted ones and
         * applies visibility/opacity changes. Changes are applied to the map
         * directly (not via Overlay.update/save) so the reconcile does not
         * PATCH the API and echo the event back to the originating client.
         */
        reconcileOverlays: async function(): Promise<void> {
            if (!this.isLoaded) return;

            const desired = await OverlayManager.list({ localFirst: true });
            const desiredIds = new Set(desired.map((item) => item.id));

            // Remove overlays deleted by the other client - the API record is
            // already gone so only tear down the local map layers
            for (const overlay of [...OverlayManager.loaded]) {
                if (overlay._internal) continue;
                if (desiredIds.has(overlay.id)) continue;

                const pos = OverlayManager.loaded.indexOf(overlay);
                if (pos !== -1) OverlayManager.loaded.splice(pos, 1);

                if (overlay._timer) {
                    clearInterval(overlay._timer);
                    overlay._timer = null;
                }

                overlay._destroyed = true;
                overlay.remove();
            }

            for (const item of desired) {
                const loaded = OverlayManager.loadedFrom(item.id);

                if (loaded) {
                    if (item.opacity !== loaded.opacity) {
                        loaded.opacity = item.opacity;
                        for (const l of loaded.styles) {
                            if (loaded.type === 'raster') {
                                this.map.setPaintProperty(l.id, 'raster-opacity', Number(loaded.opacity));
                            }
                        }
                    }

                    if (item.visible !== loaded.visible) {
                        loaded.visible = item.visible;
                        for (const l of loaded.styles) {
                            this.map.setLayoutProperty(l.id, 'visibility', loaded.visible ? 'visible' : 'none');
                        }
                    }
                } else {
                    try {
                        const overlay = await Overlay.create(item as ProfileOverlay, { skipSave: true });
                        OverlayManager.appendLoaded(overlay);

                        if (overlay.mode === 'mission' && overlay.mode_id) {
                            overlay.loading = true;
                            this.loadMission(overlay.mode_id, { reload: true })
                                .catch((err) => {
                                    console.error('Failed to load Mission after sync', err);
                                    overlay._error = err instanceof Error ? err : new Error(String(err));
                                })
                                .finally(() => {
                                    overlay.loading = false;
                                });
                        }
                    } catch (err) {
                        console.error(`Failed to load synced overlay ${item.id} (${item.name}):`, err);
                    }
                }
            }

            await this.updateAttribution();
        },
        updateIconRotation: function(enabled: boolean): void {
            for (const overlay of OverlayManager.loaded) {
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
                                ['==', ['geometry-type'], 'Point'],
                                ['has', 'course'],
                                ['has', 'group']
                            ]);
                        } else {
                            // When rotation disabled, show course arrows for all features with course
                            this.map.setFilter(courseLayerId, [
                                'all',
                                ['==', ['geometry-type'], 'Point'],
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
            const attributionPromises = OverlayManager.visibleBasemaps().map(async (overlay) => {
                    try {
                        const basemapRes = await server.GET('/api/basemap/{:basemapid}', {
                            params: { path: { ':basemapid': Number(overlay.mode_id) } }
                        });
                        if (basemapRes.error) return null;
                        return (basemapRes.data as Basemap).attribution;
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
            const clickMap = OverlayManager.clickableLayerMap();

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
