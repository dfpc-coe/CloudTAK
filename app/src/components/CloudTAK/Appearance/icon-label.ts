import Icon from '../../../base/icon.ts';
import Iconset from '../../../base/iconset.ts';

/**
 * Human readable label for an Iconset icon key - "Fire (Incident)" for
 * "<iconsetUid>:Incident/Fire". Falls back to the path when the icon is not
 * cached locally
 */
export async function iconsetIconLabel(icon: string): Promise<string> {
    const [uid, ...rest] = icon.split(':');
    const path = rest.join(':').replace(/\.png$/i, '');
    const name = path.split('/').pop() || path;

    try {
        const [entry, sets] = await Promise.all([
            Icon.get(icon.replace(/\.png$/i, '')),
            Iconset.list()
        ]);

        const set = sets.find((set) => set.uid === uid);
        const label = entry ? entry.path.split('/').pop()?.replace(/\.png$/i, '') || name : name;

        return set ? `${label} (${set.name})` : label;
    } catch (err) {
        console.warn('Could not resolve icon label:', err);
        return name;
    }
}
