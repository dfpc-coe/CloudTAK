import { server } from '../std.ts';
import { setCoordinateSystems } from './coordinateFormat.ts';

/**
 * Fetch the extra coordinate systems the server offers (ie NZTM) so they appear
 * next to the built-in formats. Failing to load them is not fatal: the
 * built-in formats keep working.
 */
export async function loadCoordinateSystems(): Promise<void> {
    try {
        const { data, error } = await server.GET('/api/config/coordinate-systems');
        if (error) throw new Error(String(error));
        if (data) setCoordinateSystems(data.crs);
    } catch (err) {
        console.warn('Unable to load coordinate systems', err);
    }
}
