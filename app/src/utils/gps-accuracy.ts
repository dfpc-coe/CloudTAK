export const GPS_ACCURACY_GOOD_METERS = 50;
export const GPS_ACCURACY_FAIR_METERS = 200;

export const GPS_LOCATION_ZOOM = 14;

export function gpsAccuracyColor(accuracy: number): string {
    if (accuracy <= GPS_ACCURACY_GOOD_METERS) return '#22c55e';
    if (accuracy <= GPS_ACCURACY_FAIR_METERS) return '#eab308';
    return '#ef4444';
}

export function isAccurateGpsFix(accuracy: number | undefined): boolean {
    return typeof accuracy === 'number'
        && Number.isFinite(accuracy)
        && accuracy > 0
        && accuracy <= GPS_ACCURACY_GOOD_METERS;
}
