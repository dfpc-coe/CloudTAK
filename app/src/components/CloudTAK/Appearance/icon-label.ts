import Icon from '../../../base/icon.ts';
import Iconset from '../../../base/iconset.ts';

/**
 * Human readable label for an Iconset icon key - "Fire (Incident)" for
 * "<iconsetUid>:Incident/Fire". Falls back to the path when the icon is not
 * cached locally
 */
export async function iconsetIconLabel(icon: string): Promise<string> {
    const { iconset: uid, path } = Icon.parse(icon) ?? { iconset: '', path: icon };
    const name = Icon.leaf(path);

    try {
        const [entry, sets] = await Promise.all([
            Icon.get(Icon.key(icon)),
            Iconset.list()
        ]);

        const set = sets.find((set) => set.uid === uid);
        const label = entry ? Icon.leaf(entry.path) || name : name;

        return set ? `${label} (${set.name})` : label;
    } catch (err) {
        console.warn('Could not resolve icon label:', err);
        return name;
    }
}
