/*
 * Validators in this file are used to Validate TablerInput fields
 * and as such should generally expect to recieve user entered strings
 */

export interface Validator {
    (text: string): string;
}

export function validateJSON(text: string): string {
    if (!text) return '';

    try {
        JSON.parse(text);
    } catch (err) {
        return err instanceof Error ? err.message : String(err);
    }

    return '';
}

export function validateURL(text: string): string {
    if (!text) return '';

    if (!text.startsWith('http://') && !text.startsWith('https://')) {
        return 'URL must start with http:// or https://';
    }

    try {
        new URL(text);
    } catch (err) {
        return err instanceof Error ? err.message : String(err);
    }

    return '';
}

export function validateLatLng(text: string): string {
    const dd = text.split(',').map((d) => {
        return Number(d.trim())
    });

    const errors = [];
    if (dd.length !== 2) errors.push('Must have contain latitude,longitude');
    if (isNaN(dd[0])) errors.push('First number (latitude) is not a number');
    if (isNaN(dd[1])) errors.push('Second number (longitude) is not a number');

    if (dd[0] < -90) errors.push('Latitude cannot be less than -90°');
    if (dd[0] > 90) errors.push('Latitude cannot exceed 90°');

    if (dd[1] < -180) errors.push('Longitude cannot be less than -180°');
    if (dd[1] > 180) errors.push('Longitude cannot exceed 180°');

    return errors.length ? errors[0] : '';
}
