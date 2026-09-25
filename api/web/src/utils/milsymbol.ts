import ms from 'milsymbol';

/**
 * MIL-STD symbol generation shared by the map's Icon Manager and DOM previews
 * so a symbol looks the same wherever it is drawn
 */

/** Render size (px) of a generated symbol */
export const SYMBOL_SIZE = 24;

/** Icon ids of the form `2525<Variant>:<SIDC>` resolve to a generated symbol */
const MILSYM_PREFIX = /^2525[CDE]:/;

const dataURLs = new Map<string, string>();

export function isMilsymIcon(id: string): boolean {
    return MILSYM_PREFIX.test(id);
}

function sidc(id: string): string {
    return id.replace(MILSYM_PREFIX, '');
}

/** @param id A bare SIDC or a `2525<Variant>:<SIDC>` icon id */
export function symbolCanvas(id: string): HTMLCanvasElement {
    return new ms.Symbol(sidc(id), { size: SYMBOL_SIZE }).asCanvas();
}

/**
 * Cached per SIDC and size so a list of Features sharing a symbol renders it
 * once rather than once per instance
 *
 * @param id A bare SIDC or a `2525<Variant>:<SIDC>` icon id
 */
export function symbolDataURL(id: string, size = SYMBOL_SIZE): string {
    const key = `${sidc(id)}:${size}`;

    let url = dataURLs.get(key);

    if (!url) {
        url = new ms.Symbol(sidc(id), { size }).toDataURL();
        dataURLs.set(key, url);
    }

    return url;
}
