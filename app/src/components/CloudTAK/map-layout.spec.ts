import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The banner above the GPS panel (BroadcastChip) and the plugin pane take no layout room of their own, so
 * everything anchored above the GPS panel has to add the room they need to its offset (Map.vue
 * `--map-gps-chip-size` and `--map-plugin-pane-size`). This reads the sources, as a computed layout cannot
 * be had in jsdom, and fails when a new offset starts from the GPS panel's height alone.
 */
const read = (file: string): string => readFileSync(resolve(process.cwd(), 'src/components/CloudTAK', file), 'utf8');
const sources = {
    'Map.vue': read('Map.vue'),
    'PluginPane.vue': read('PluginPane.vue'),
    'GPSPanel.vue': read('GPSPanel/GPSPanel.vue'),
};

/** Every `bottom:` declaration that starts from the GPS panel's height, with the file it is in */
function offsets(): Array<{ file: string; value: string }> {
    const found: Array<{ file: string; value: string }> = [];

    for (const [file, text] of Object.entries(sources)) {
        for (const match of text.matchAll(/bottom:\s*(calc\([^;]*--map-gps-panel-size[^;]*\));/g)) {
            found.push({ file, value: match[1] });
        }
    }

    return found;
}

describe('bottom-left layout', () => {
    it('finds the anchored offsets, so the check below is not empty', () => {
        expect(offsets().map((o) => o.file).sort()).toEqual(['Map.vue', 'Map.vue', 'PluginPane.vue']);
    });

    it('every offset above the GPS panel leaves room for the banner', () => {
        for (const { file, value } of offsets()) {
            expect(value, `${file}: ${value}`).toContain('--map-gps-chip-size');
        }
    });

    it('the Selected Features window also goes above the plugin pane on small screens', () => {
        const selected = offsets().find((o) => o.value.includes('--map-plugin-pane-size'));
        expect(selected, 'an offset that adds --map-plugin-pane-size').toBeDefined();
        expect(sources['Map.vue']).toContain('.selected-features-anchor');
    });

    it('the variables start at 0 and are set by the modifiers', () => {
        const map = sources['Map.vue'];
        expect(map).toMatch(/--map-gps-chip-size:\s*0px/);
        expect(map).toMatch(/\.map-shell--broadcast-chip\s*\{\s*--map-gps-chip-size:\s*42px/);
        expect(map).toMatch(/--map-plugin-pane-size:\s*0px/);
        expect(map).toMatch(/\.map-shell--plugin-pane\s*\{\s*--map-plugin-pane-size:\s*58px/);
    });

    it('the GPS panel sizes itself by --map-gps-panel-size only', () => {
        expect(sources['GPSPanel.vue']).toMatch(/height:\s*var\(--map-gps-panel-size, 84px\)/);
    });
});
