import {
    TerraDrawExtend,
    type GeoJSONStoreFeatures,
    type TerraDrawAdapterStyling,
    type TerraDrawKeyboardEvent,
    type TerraDrawMouseEvent,
} from 'terra-draw';
import type { LineString, Position } from 'geojson';
import {
    axisOfAdvanceCenterline,
    axisOfAdvancePolygon,
    controlPointForWidth,
    defaultWidthMeters,
    widthFromControlPoint,
} from './axis-of-advance.ts';

const { TerraDrawBaseDrawMode, getDefaultStyling } = TerraDrawExtend;

type FeatureId = TerraDrawExtend.FeatureId;

type ValidationContext = Parameters<NonNullable<TerraDrawExtend.BaseModeOptions<AxisOfAdvanceStyling>['validation']>>[1];

export const AXIS_OF_ADVANCE_MODE = 'axis-of-advance';

export type AxisOfAdvanceStep = 'path' | 'width';

/**
 * Property names written onto store features so the host can tell the
 * centerline, the preview outline and the vertex markers apart.
 */
export const AXIS_PROPERTIES = {
    path: 'axisPath',
    preview: 'axisPreview',
    point: 'coordinatePoint',
    step: 'axisStep',
    committed: 'axisCommitted',
    width: 'widthMeters',
    controlPoint: 'controlPoint',
} as const;

type AxisOfAdvanceStyling = {
    lineStringWidth: TerraDrawExtend.NumericStyling;
    lineStringColor: TerraDrawExtend.HexColorStyling;
    lineStringOpacity: TerraDrawExtend.NumericStyling;
    fillColor: TerraDrawExtend.HexColorStyling;
    fillOpacity: TerraDrawExtend.NumericStyling;
    outlineColor: TerraDrawExtend.HexColorStyling;
    outlineWidth: TerraDrawExtend.NumericStyling;
    outlineOpacity: TerraDrawExtend.NumericStyling;
    coordinatePointColor: TerraDrawExtend.HexColorStyling;
    coordinatePointWidth: TerraDrawExtend.NumericStyling;
    coordinatePointOutlineColor: TerraDrawExtend.HexColorStyling;
    coordinatePointOutlineWidth: TerraDrawExtend.NumericStyling;
};

type KeyEvents = {
    cancel: KeyboardEvent['key'] | null;
    finish: KeyboardEvent['key'] | null;
};

type Cursors = {
    draw?: TerraDrawExtend.Cursor;
    close?: TerraDrawExtend.Cursor;
    width?: TerraDrawExtend.Cursor;
};

const defaultKeyEvents: KeyEvents = { cancel: 'Escape', finish: 'Enter' };
const defaultCursors: Required<Cursors> = { draw: 'crosshair', close: 'pointer', width: 'ew-resize' };

export interface TerraDrawAxisOfAdvanceModeOptions<T extends TerraDrawExtend.CustomStyling>
    extends TerraDrawExtend.BaseModeOptions<T> {
    keyEvents?: KeyEvents | null;
    cursors?: Cursors;
    pointerDistance?: number;
}

/**
 * Draws a MIL-STD-2525 Axis of Advance.
 *
 * Interaction:
 * 1. Click along the direction of advance, tail first. The arrow outline
 *    previews as the cursor moves.
 * 2. Click the last vertex again (or press Finish) to lock the path.
 * 3. Move the cursor to set the arrow width and click (or press Finish).
 *
 * The finished feature is a LineString whose coordinates run head first,
 * matching the point order ATAK and the mil-sym renderer expect, with
 * `widthMeters` and `controlPoint` properties describing the arrow head.
 */
export class TerraDrawAxisOfAdvanceMode extends TerraDrawBaseDrawMode<AxisOfAdvanceStyling> {
    mode = AXIS_OF_ADVANCE_MODE;

    private keyEvents: KeyEvents = defaultKeyEvents;
    private cursors: Required<Cursors> = defaultCursors;

    private currentId: FeatureId | undefined;
    private previewId: FeatureId | undefined;
    private pointIds: FeatureId[] = [];

    private step: AxisOfAdvanceStep | undefined;
    private committed: Position[] = [];
    private width: number | undefined;
    private controlPoint: Position | undefined;

    constructor(options?: TerraDrawAxisOfAdvanceModeOptions<AxisOfAdvanceStyling>) {
        super(options, true);
        this.updateOptions(options);
    }

    override updateOptions(options?: Partial<TerraDrawAxisOfAdvanceModeOptions<AxisOfAdvanceStyling>>) {
        super.updateOptions(options);

        if (options?.cursors) {
            this.cursors = { ...this.cursors, ...options.cursors };
        }

        if (options?.keyEvents === null) {
            this.keyEvents = { cancel: null, finish: null };
        } else if (options?.keyEvents) {
            this.keyEvents = { ...this.keyEvents, ...options.keyEvents };
        }
    }

    private round(coord: Position): Position {
        const factor = Math.pow(10, this.coordinatePrecision);
        return [
            Math.round(coord[0] * factor) / factor,
            Math.round(coord[1] * factor) / factor
        ];
    }

    private pixelDistance(event: TerraDrawMouseEvent, coord: Position): number {
        const { x, y } = this.project(coord[0], coord[1]);
        const dx = x - event.containerX;
        const dy = y - event.containerY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private has(id: FeatureId | undefined): id is FeatureId {
        return id !== undefined && this.store.has(id);
    }

    private properties(extra: Record<string, string | number | boolean>) {
        return { mode: this.mode, ...extra };
    }

    private currentWidth(): number {
        return this.width ?? defaultWidthMeters(this.committed);
    }

    private setStep(step: AxisOfAdvanceStep) {
        this.step = step;
        if (this.has(this.currentId)) {
            this.store.updateProperty([{ id: this.currentId, property: AXIS_PROPERTIES.step, value: step }]);
        }
    }

    private updateLine(provisional?: Position) {
        if (!this.has(this.currentId)) return;

        const coordinates = provisional ? [...this.committed, provisional] : this.committed.slice();
        if (coordinates.length < 2) return;

        this.store.updateGeometry([{
            id: this.currentId,
            geometry: { type: 'LineString', coordinates }
        }]);
    }

    private updatePreview(path: Position[], width: number) {
        const polygon = axisOfAdvancePolygon(path, width);

        if (!polygon) {
            if (this.has(this.previewId)) {
                this.store.delete([this.previewId]);
                this.previewId = undefined;
            }
            return;
        }

        if (this.has(this.previewId)) {
            this.store.updateGeometry([{ id: this.previewId, geometry: polygon }]);
        } else {
            const [id] = this.store.create([{
                geometry: polygon,
                properties: this.properties({ [AXIS_PROPERTIES.preview]: true })
            }]);
            this.previewId = id;
        }
    }

    private addPoint(coord: Position) {
        const [id] = this.store.create([{
            geometry: { type: 'Point', coordinates: coord },
            properties: this.properties({ [AXIS_PROPERTIES.point]: true })
        }]);
        this.pointIds.push(id);
    }

    private commit(coord: Position) {
        this.committed.push(coord);
        this.addPoint(coord);

        if (this.has(this.currentId)) {
            this.store.updateProperty([{
                id: this.currentId,
                property: AXIS_PROPERTIES.committed,
                value: this.committed.length
            }]);
        }
    }

    private beginWidthStep() {
        if (this.committed.length < 2) return;

        this.updateLine();
        this.updatePreview(this.committed, this.currentWidth());
        this.setStep('width');
        this.setCursor(this.cursors.width);
    }

    private finish() {
        if (!this.has(this.currentId) || this.committed.length < 2) return;

        const width = this.currentWidth();
        const controlPoint = this.controlPoint ?? controlPointForWidth(this.committed, width);
        const id = this.currentId;

        this.store.updateGeometry([{ id, geometry: axisOfAdvanceCenterline(this.committed) }]);
        this.store.updateProperty([
            { id, property: AXIS_PROPERTIES.width, value: width },
            { id, property: AXIS_PROPERTIES.controlPoint, value: this.round(controlPoint) },
            { id, property: AXIS_PROPERTIES.step, value: undefined },
            { id, property: AXIS_PROPERTIES.committed, value: undefined },
        ]);

        const helpers = [this.previewId, ...this.pointIds].filter((hid): hid is FeatureId => this.has(hid));
        if (helpers.length) this.store.delete(helpers);

        this.reset();

        if (this.validate) {
            const validation = this.validate(this.store.copy(id), {
                project: this.project,
                unproject: this.unproject,
                coordinatePrecision: this.coordinatePrecision,
                updateType: 'finish' as unknown as ValidationContext['updateType']
            });

            if (!validation.valid) {
                this.store.delete([id]);
                return;
            }
        }

        this.onFinish(id, { mode: this.mode, action: 'draw' });
    }

    private reset() {
        this.currentId = undefined;
        this.previewId = undefined;
        this.pointIds = [];
        this.step = undefined;
        this.committed = [];
        this.width = undefined;
        this.controlPoint = undefined;

        if (this.state === 'drawing') {
            this.setStarted();
        }
    }

    /** @internal */
    start() {
        this.setStarted();
        this.setCursor(this.cursors.draw);
    }

    /** @internal */
    stop() {
        this.cleanUp();
        this.setStopped();
        this.setCursor('unset');
    }

    /** @internal */
    onMouseMove(event: TerraDrawMouseEvent) {
        const coord = this.round([event.lng, event.lat]);

        if (this.step === 'path') {
            const last = this.committed[this.committed.length - 1];
            const closing = this.committed.length >= 2 && this.pixelDistance(event, last) < this.pointerDistance;

            this.setCursor(closing ? this.cursors.close : this.cursors.draw);
            this.updateLine(coord);
            this.updatePreview(closing ? this.committed : [...this.committed, coord], this.currentWidth());
        } else if (this.step === 'width') {
            const width = widthFromControlPoint(this.committed, coord);
            if (width > 0) {
                this.width = width;
                this.controlPoint = coord;
                this.updatePreview(this.committed, width);
            }
        } else {
            this.setCursor(this.cursors.draw);
        }
    }

    /** @internal */
    onClick(event: TerraDrawMouseEvent) {
        if (event.button === 'right') return;

        const coord = this.round([event.lng, event.lat]);

        if (this.currentId && !this.store.has(this.currentId)) {
            this.reset();
        }

        if (!this.step) {
            const [id] = this.store.create([{
                geometry: { type: 'LineString', coordinates: [coord, coord] },
                properties: this.properties({
                    [AXIS_PROPERTIES.path]: true,
                    [AXIS_PROPERTIES.step]: 'path',
                    [AXIS_PROPERTIES.committed]: 0
                })
            }]);

            this.currentId = id;
            this.step = 'path';
            this.commit(coord);

            if (this.state === 'started') {
                this.setDrawing();
            }
        } else if (this.step === 'path') {
            const last = this.committed[this.committed.length - 1];

            if (this.committed.length >= 2 && this.pixelDistance(event, last) < this.pointerDistance) {
                this.beginWidthStep();
                return;
            }

            if (this.pixelDistance(event, last) < this.pointerDistance) return;

            this.commit(coord);
            this.updateLine(coord);
        } else if (this.step === 'width') {
            const width = widthFromControlPoint(this.committed, coord);
            if (width > 0) {
                this.width = width;
                this.controlPoint = coord;
            }
            this.finish();
        }
    }

    /** @internal */
    onKeyUp(event: TerraDrawKeyboardEvent) {
        if (event.key === this.keyEvents.cancel) {
            this.cleanUp();
        } else if (event.key === this.keyEvents.finish) {
            if (this.step === 'path') {
                this.beginWidthStep();
            } else if (this.step === 'width') {
                this.finish();
            }
        }
    }

    /** @internal */
    cleanUp() {
        if (!this.store) return;

        const present = [this.currentId, this.previewId, ...this.pointIds]
            .filter((id): id is FeatureId => this.has(id));

        if (present.length) this.store.delete(present);

        this.reset();
    }

    /** @internal */
    styleFeature(feature: GeoJSONStoreFeatures): TerraDrawAdapterStyling {
        const styles = getDefaultStyling();

        if (feature.properties.mode !== this.mode) return styles;

        if (feature.geometry.type === 'Polygon') {
            styles.polygonFillColor = this.getHexColorStylingValue(this.styles.fillColor, styles.polygonFillColor, feature);
            styles.polygonFillOpacity = this.getNumericStylingValue(this.styles.fillOpacity, 0.2, feature);
            styles.polygonOutlineColor = this.getHexColorStylingValue(this.styles.outlineColor, styles.polygonOutlineColor, feature);
            styles.polygonOutlineWidth = this.getNumericStylingValue(this.styles.outlineWidth, 2, feature);
            styles.polygonOutlineOpacity = this.getNumericStylingValue(this.styles.outlineOpacity, 1, feature);
            styles.zIndex = 5;
        } else if (feature.geometry.type === 'LineString') {
            styles.lineStringColor = this.getHexColorStylingValue(this.styles.lineStringColor, styles.lineStringColor, feature);
            styles.lineStringWidth = this.getNumericStylingValue(this.styles.lineStringWidth, 2, feature);
            styles.lineStringOpacity = this.getNumericStylingValue(this.styles.lineStringOpacity, 0.6, feature);
            styles.zIndex = 10;
        } else if (feature.geometry.type === 'Point') {
            styles.pointColor = this.getHexColorStylingValue(this.styles.coordinatePointColor, styles.pointColor, feature);
            styles.pointWidth = this.getNumericStylingValue(this.styles.coordinatePointWidth, 5, feature);
            styles.pointOutlineColor = this.getHexColorStylingValue(this.styles.coordinatePointOutlineColor, styles.pointOutlineColor, feature);
            styles.pointOutlineWidth = this.getNumericStylingValue(this.styles.coordinatePointOutlineWidth, 2, feature);
            styles.zIndex = 20;
        }

        return styles;
    }

    validateFeature(feature: unknown) {
        return this.validateModeFeature(feature, (f) => {
            const geometry = f.geometry as LineString;

            if (geometry.type !== 'LineString') {
                return { valid: false, reason: 'Axis of Advance must be a LineString' };
            }

            if (geometry.coordinates.length < 2) {
                return { valid: false, reason: 'Axis of Advance needs at least two coordinates' };
            }

            return { valid: true };
        });
    }
}
