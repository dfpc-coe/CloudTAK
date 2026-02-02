import * as terraDraw from 'terra-draw';
import {
    TerraDrawMapLibreGLAdapter
} from 'terra-draw-maplibre-gl-adapter';
import { TerraRoute } from 'terra-route'
import {
    Routing,
    TerraDrawRouteSnapMode
} from 'terra-draw-route-snap-mode'
import { v4 as randomUUID } from 'uuid';
import mapgl from 'maplibre-gl'
import pointOnFeature from '@turf/point-on-feature';
import { coordEach } from '@turf/meta';
import { distance } from '@turf/distance';
import type { GeoJSONFeatureId } from 'maplibre-gl'
import type COT from '../../base/cot.ts';
import Filter from '../../base/filter.ts';
import { OriginMode } from '../../base/cot.ts';
import { std, stdurl } from '../../std.ts';
import type { Feature, FeatureCollection } from '../../types.ts';
import type { Polygon, Position, LineString, FeatureCollection as GeoJSONFeatureCollection } from 'geojson';
import type { useMapStore } from '../map.ts';

export enum DrawToolMode {
    STATIC = 'static',
    FREEHAND = 'freehand',
    SELECT = 'select',

    POINT = 'point',
    LINESTRING = 'linestring',
    SNAPPING = 'routesnap',
    POLYGON = 'polygon',
    RECTANGLE = 'angled-rectangle',
    CIRCLE = 'circle',
    SECTOR = 'sector',
}

export default class DrawTool {
    private draw: terraDraw.TerraDraw;
    public editing: COT | null;

    public mode: DrawToolMode;

    private graph: Routing;

    private mapStore: ReturnType<typeof useMapStore>;

    // Contains coordinates to allow snapping to
    public snapping: Set<[number, number]>;

    public point: {
        type: string,
    };

    public lasso: {
        loading: boolean;
        overlay: string;
    }

    private _snappingLayer: string = 'No Snapping';
    public snappingOptions: string[] = ['No Snapping'];

    public get snappingLayer(): string {
        return this._snappingLayer;
    }

    public set snappingLayer(layer: string) {
        this._snappingLayer = layer;
        if (this._snappingLayer === 'No Snapping') {
            if (this.mode === DrawToolMode.SNAPPING) {
               this.start(DrawToolMode.LINESTRING);
            }
        } else {
            if (this.mode === DrawToolMode.LINESTRING) {
                this.start(DrawToolMode.SNAPPING);
            } else if (this.mode === DrawToolMode.SNAPPING) {
                this.start(DrawToolMode.SNAPPING);
            }
        }
    }

    constructor(mapStore: ReturnType<typeof useMapStore>) {
        this.mapStore = mapStore;

        const toCustom = (event: terraDraw.TerraDrawMouseEvent): Position | undefined => {
            let closest: {
                dist: number
                coord: Position
            } | undefined = undefined;

            for (const coord of this.snapping.values()) {
                const dist = distance([event.lng, event.lat], coord);

                if (!closest || (dist < closest.dist)) {
                    closest = { dist, coord }
                }
            }

            if (closest) {
                // Base Threshold / Math.pow(decayFactor, zoomLevel)
                const threshold = 1000 / Math.pow(2, this.mapStore.map.getZoom());

                if (closest.dist < threshold) {
                    return closest.coord;
                }

                return;
            } else {
                return;
            }
        }

        const routeFinderInstance = new TerraRoute();
        const routeFinder = Object.assign(routeFinderInstance, {
            setNetwork: routeFinderInstance.buildRouteGraph.bind(routeFinderInstance),
            expandNetwork: () => {}
        });

        this.graph = new Routing({
            network: {
                type: 'FeatureCollection' as const,
                features: []
            },
            useCache: true,
            routeFinder
        })

        this.draw = new terraDraw.TerraDraw({
            adapter: new TerraDrawMapLibreGLAdapter({
                map: this.mapStore.map,
                // @ts-expect-error TS is complaining
                lib: mapgl
            }),
            idStrategy: {
                isValidId: (id: string | number): boolean => {
                    return typeof id === "string"
                },
                getId: (function () {
                    return function () {
                        return randomUUID()
                    };
                })()
            },
            modes: [
                new terraDraw.TerraDrawPointMode({
                    editable: true
                }),
                new terraDraw.TerraDrawLineStringMode({
                    editable: true,
                    snapping: { toCustom }
                }),
                new terraDraw.TerraDrawPolygonMode({
                    editable: true,
                    showCoordinatePoints: true,
                    snapping: { toCustom }
                }),
                new TerraDrawRouteSnapMode({
                   routing: this.graph,
                   maxPoints: 5,
                   styles: {
                       lineStringColor: () => {
                           // RED
                           return '#990000';
                       },
                       routePointColor: () => {
                            // RED
                            return '#990000';
                       }
                   }
                }),
                new terraDraw.TerraDrawAngledRectangleMode(),
                new terraDraw.TerraDrawFreehandMode(),
                new terraDraw.TerraDrawSectorMode(),
                new terraDraw.TerraDrawCircleMode(),
                new terraDraw.TerraDrawSelectMode({
                    flags: {
                        polygon: {
                            feature: {
                                draggable: true,
                                coordinates: {
                                    snappable: true,
                                    deletable: true,
                                    midpoints: {
                                        draggable: true
                                    },
                                    draggable: true,
                                }
                            }
                        },
                        linestring: {
                            feature: {
                                draggable: true,
                                coordinates: {
                                    snappable: true,
                                    deletable: true,
                                    midpoints: {
                                        draggable: true
                                    },
                                    draggable: true,
                                }
                            }
                        },
                        point: {
                            feature: {
                                draggable: true,
                            }
                        }
                    }
                })
            ]
        });

        this.draw.on('finish', async (id, context) => {
            if (context.action === "draw") {
                if (this.draw.getMode() === DrawToolMode.STATIC || this.editing) {
                    return;
                } else if (this.mode === DrawToolMode.FREEHAND) {
                    const feat = this.draw.getSnapshotFeature(id);
                    if (!feat) throw new Error('Could not find underlying marker');
                    this.removeFeature(id);
                    this.stop();

                    if (!this.lasso.overlay || this.lasso.overlay === "CoT Icons") {
                        const touching = await this.mapStore.worker.db.touching(feat.geometry as Polygon);

                        for (const cot of touching.values()) {
                            this.mapStore.selected.set(cot.id, cot);
                        }
                    } else {
                        const ov = this.mapStore.getOverlayByName(this.lasso.overlay);
                        if (!ov) throw new Error('Could not find overlay');

                        this.lasso.loading = true;

                        try {
                            const url = stdurl(`/api/basemap/${ov.mode_id}/feature`);

                            const fc = await std(url, {
                                method: 'POST',
                                body: {
                                    polygon: feat.geometry
                                }
                            }) as FeatureCollection;

                            mapStore.toImport = fc.features.map((f) => {
                                const id = randomUUID();

                                return {
                                    id,
                                    type: 'Feature',
                                    path: '/',
                                    properties: {
                                       id,
                                       type: 'u-d-p',
                                       how: 'h-g-i-g-o',
                                       color: '#00FF00',
                                       archived: true,
                                       time: new Date().toISOString(),
                                       start: new Date().toISOString(),
                                       stale: new Date().toISOString(),
                                       center: pointOnFeature(f).geometry.coordinates,
                                       callsign: 'New Feature'
                                    },
                                    geometry: f.geometry
                                }
                            });

                            this.lasso.loading = false;
                        } catch (err) {
                            this.lasso.loading = false;
                            console.error(err);
                            throw new Error('Error fetching lasso features');
                        }
                    }
                } else {
                    const storeFeat = this.draw.getSnapshotFeature(id);
                    if (!storeFeat) throw new Error('Could not find underlying marker');

                    const now = new Date();
                    const feat: Feature = {
                        id: String(id),
                        type: 'Feature',
                        path: '/',
                        properties: {
                            id: String(id),
                            type: 'u-d-p',
                            how: 'h-g-i-g-o',
                            archived: true,
                            callsign: 'New Feature',
                            time: now.toISOString(),
                            start: now.toISOString(),
                            stale: new Date(now.getTime() + 3600).toISOString(),
                            center: [0,0]
                        },
                        geometry: JSON.parse(JSON.stringify(storeFeat.geometry))
                    };

                    if (
                        this.mode === DrawToolMode.POLYGON
                        || this.mode === DrawToolMode.RECTANGLE
                        || this.mode === DrawToolMode.SECTOR
                    ) {
                        feat.properties.type = 'u-d-f';
                    } else if (this.mode === DrawToolMode.LINESTRING) {
                        feat.properties.type = 'u-d-f';
                    } else if (this.mode === DrawToolMode.CIRCLE) {
                        feat.properties.type = 'u-d-c-c';
                    } else if (this.mode === DrawToolMode.POINT) {
                        feat.properties.type = this.point.type
                        feat.properties["marker-opacity"] = 1;

                        if (this.point.type === 'u-d-p') {
                            feat.properties["marker-color"] = '#00FF00';
                        } else {
                            feat.properties["marker-color"] = '#FFFFFF';
                        }
                    }

                    this.removeFeature(id);

                    await this.stop();

                    await this.mapStore.worker.db.add(feat, {
                        authored: true
                    });

                    await this.mapStore.refresh();
                }
            }
        })

        // Deselect event is for editing existing features
        this.draw.on('deselect', async () => {
            if (!this.editing) return;

            const feat = this.draw.getSnapshotFeature(this.editing.id);

            if (!feat) throw new Error('Could not find underlying marker');

            delete feat.properties.center;

            const editing = this.editing;

            await this.stop();

            await this.mapStore.worker.db.add(feat as Feature, {
                authored: true
            });

            await this.mapStore.refresh();

            if (editing && editing.origin.mode === OriginMode.MISSION && editing.origin.mode_id) {
                await this.mapStore.loadMission(editing.origin.mode_id);
            } else {
                await this.mapStore.worker.db.unhide(editing.id);
                await this.mapStore.refresh();
            }
        });

        this.mode = DrawToolMode.STATIC;
        this.snapping = new Set();
        this.editing = null;

        this.point = {
            type: 'u-d-p'
        }

        this.lasso = {
            loading: false,
            overlay: 'CoT Icons'
        }
    }

    async populateSnappingLayers(): Promise<void> {
        if (this.mapStore.hasSnapping) {
            const url = stdurl('/api/basemap');
            url.searchParams.append('snapping', 'true');
            url.searchParams.append('hidden', 'all');
            url.searchParams.append('overlay', 'true');

            const res = await std(url);
            // @ts-expect-error type
            if (res.items) {
                // @ts-expect-error type
                this.snappingOptions = ['No Snapping'].concat(res.items.map((b) => b.name));
            }
        }
    }

    async start(mode: DrawToolMode): Promise<void> {
        this.mode = mode;

        if (mode === DrawToolMode.SNAPPING) {
            let network: GeoJSONFeatureCollection<LineString>;

            if (this.snappingLayer && this.snappingLayer !== 'No Snapping') {
                const url = new URL('https://tiles.map.cotak.gov/tiles/public/snapping/features')
                url.searchParams.set('token', localStorage.token);
                url.searchParams.set('bbox', this.mapStore.map.getBounds().toArray().join(','));
                url.searchParams.set('type', 'LineString');
                url.searchParams.set('multi', 'false');

                network = await std(url) as GeoJSONFeatureCollection<LineString>;
            }

            this.graph.setNetwork(network);

            const source = this.mapStore.map.getSource('snapping-graph-source') as mapgl.GeoJSONSource;
            if (source) {
                source.setData(network);
            } else {
                this.mapStore.map.addSource('snapping-graph-source', {
                    type: 'geojson',
                    data: network
                });
                this.mapStore.map.addLayer({
                    id: 'snapping-graph-layer',
                    type: 'line',
                    source: 'snapping-graph-source',
                    layout: {
                        'line-join': 'round',
                        'line-cap': 'round'
                    },
                    paint: {
                        'line-color': '#5fb7ce',
                        'line-width': 2,
                        'line-dasharray': [2, 2],
                        'line-opacity': 0.8
                    }
                });
            }

            this.draw.start();

            this.draw.updateModeOptions(DrawToolMode.SNAPPING, {
                routing: this.graph,
                maxPoints: 5,
            });

            this.draw.setMode(mode)
        } else {
            this.draw.start();
            this.draw.setMode(mode)

            this.snapping = await this.mapStore.worker.db.snapping(
                this.mapStore.map.getBounds().toArray()
            );
        }
    }

    async stop(refresh = true): Promise<void> {
        this.mode = DrawToolMode.STATIC;

        if (this.mapStore.map.getLayer('snapping-graph-layer')) {
            this.mapStore.map.removeLayer('snapping-graph-layer');
        }

        if (this.mapStore.map.getSource('snapping-graph-source')) {
            this.mapStore.map.removeSource('snapping-graph-source');
        }

        // Reset cursor to default BEFORE stopping draw operations
        this.mapStore.map.getCanvas().style.cursor = '';

        this.draw.stop();
        this.snapping.clear()

        if (!this.editing) return;

        await Filter.delete({ external: `hidden-${this.editing.id}` });

        if (refresh) {
            if (this.editing && this.editing.origin.mode === OriginMode.MISSION && this.editing.origin.mode_id) {
                await this.mapStore.loadMission(this.editing.origin.mode_id);
                this.editing = null;
            } else {
                await this.mapStore.worker.db.unhide(this.editing.id);
                this.editing = null;

                await this.mapStore.refresh();
            }
        }
    }

    async edit(cot: COT) {
        this.editing = cot;

        this.start(DrawToolMode.SELECT);

        try {
            const feat = cot.as_feature({ clone: true });
            if (feat.geometry.type === 'Polygon') {
                feat.properties.mode = 'polygon';
            } else if (feat.geometry.type === 'LineString') {
                feat.properties.mode = 'linestring';
            } else if (feat.geometry.type === 'Point') {
                feat.properties.mode = 'point';
            }

            coordEach(feat, (coord) => {
                if (coord.length > 2) {
                    coord.splice(2, coord.length - 2);
                }

                // Ensure precision is within bounds
                for (let i = 0; i < coord.length; i++) {
                    coord[i] = Math.round(coord[i] * Math.pow(10, 9)) / Math.pow(10, 9);
                }
            });

            await Filter.create(
                cot.properties.callsign + ' Hidden',
                `hidden-${cot.id}`,
                'AtlasDatabase',
                true,
                `id = "${cot.id}"`
           )

            if (cot.origin.mode === OriginMode.MISSION && cot.origin.mode_id) {
                await this.mapStore.loadMission(cot.origin.mode_id);
            } else {
                await this.mapStore.worker.db.hide(cot.id);
                await this.mapStore.refresh();
            }

            const errorStatus = this.draw.addFeatures([feat as terraDraw.GeoJSONStoreFeatures]).filter((status) => {
                return !status.valid;
            });

            if (errorStatus.length) {
                throw new Error('Error editing this feature: ' + errorStatus[0].reason)
            }

            this.draw.selectFeature(cot.id);
        } catch (err) {
            await this.stop();

            throw err;
        }
    }

    getFeature(id: GeoJSONFeatureId) {
        return this.draw.getSnapshotFeature(id);
    }

    removeFeature(id: GeoJSONFeatureId): void {
        return this.draw.removeFeatures([id]);
    }
}
