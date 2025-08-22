import { v4 as randomUUID } from 'uuid';
import * as terraDraw from 'terra-draw';
import mapgl from 'maplibre-gl'
import { coordEach } from '@turf/meta';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import { distance } from '@turf/distance';
import type { GeoJSONFeatureId } from 'maplibre-gl'
import type COT from '../../base/cot.ts';
import type { Feature } from '../../types.ts';
import type { Polygon, Position } from 'geojson';
import type { useMapStore } from '../map.ts';

export enum DrawToolMode {
    STATIC = 'static',
    FREEHAND = 'freehand',
    SELECT = 'select',

    POINT = 'point',
    LINESTRING = 'linestring',
    POLYGON = 'polygon',
    RECTANGLE = 'angled-rectangle',
    CIRCLE = 'circle',
    SECTOR = 'sector',
}

export default class DrawTool {
    private draw: terraDraw.TerraDraw;
    public editing: COT | null;

    public mode: DrawToolMode;

    private mapStore: ReturnType<typeof useMapStore>;

    // Contains coordinates to allow snapping to
    public snapping: Set<[number, number]>;

    public point: {
        type: string,
    };

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

                    const touching = await this.mapStore.worker.db.touching(feat.geometry as Polygon);
                    for (const cot of touching.values()) {
                        this.mapStore.selected.set(cot.id, cot);
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
                        authored: !(await this.mapStore.worker.db.has(feat.id))
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

            await this.stop();

            await this.mapStore.worker.db.add(feat as Feature);

            await this.mapStore.refresh();
        })

        this.mode = DrawToolMode.STATIC;
        this.snapping = new Set();
        this.editing = null;

        this.point = {
            type: 'u-d-p'
        }
    }

    async start(mode: DrawToolMode): Promise<void> {
        this.mode = mode;
        this.draw.start();
        this.draw.setMode(mode)

        this.snapping = await this.mapStore.worker.db.snapping(
            this.mapStore.map.getBounds().toArray()
        );
    }

    async stop(): Promise<void> {
        this.mode = DrawToolMode.STATIC;
        this.draw.stop();

        this.snapping.clear()

        if (this.editing) {
            await this.mapStore.worker.db.unhide(this.editing.id);
            this.editing = null;
            await this.mapStore.refresh();
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

            await this.mapStore.worker.db.hide(cot.id);
            await this.mapStore.refresh();

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
