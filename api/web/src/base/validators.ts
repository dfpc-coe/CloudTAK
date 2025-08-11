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

export function validateTextNotEmpty(text: string): string {
    if (!text || !text.trim()) return 'This field cannot be empty';
    return '';
}

export function validateURL(text: string, opts: {
    protocols?: string[];
}= {}): string {
    if (!text) return '';

    if (!opts.protocols) opts.protocols = ['http', 'https']

    if (!opts.protocols.some((p) => {
        return text.startsWith(p + '://')
    })) {
        return `URL must start with one of ${opts.protocols.map(p => `${p}://`).join(', ')}`;
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
