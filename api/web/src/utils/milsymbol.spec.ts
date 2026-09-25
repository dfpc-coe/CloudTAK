import { describe, expect, it, vi } from 'vitest';

const symbols: Array<{ sidc: string, size: number }> = [];

vi.mock('milsymbol', () => ({
    default: {
        Symbol: class {
            sidc: string;
            size: number;

            constructor(sidc: string, opts: { size: number }) {
                this.sidc = sidc;
                this.size = opts.size;
                symbols.push({ sidc, size: opts.size });
            }

            toDataURL() { return `data:${this.sidc}@${this.size}`; }
        }
    }
}));

import { SYMBOL_SIZE, isMilsymIcon, symbolDataURL } from './milsymbol.ts';

const SIDC = '13061500000000000000';

describe('milsymbol', () => {
    it('recognises generated symbol icon ids', () => {
        expect(isMilsymIcon(`2525E:${SIDC}`)).toBe(true);
        expect(isMilsymIcon(`2525C:${SIDC}`)).toBe(true);
        expect(isMilsymIcon(SIDC)).toBe(false);
        expect(isMilsymIcon('a-f-G-U-C-I')).toBe(false);
    });

    it('renders a prefixed icon id and a bare SIDC identically at the shared size', () => {
        expect(symbolDataURL(`2525E:${SIDC}`)).toEqual(`data:${SIDC}@${SYMBOL_SIZE}`);
        expect(symbolDataURL(SIDC)).toEqual(`data:${SIDC}@${SYMBOL_SIZE}`);
    });

    it('generates each SIDC and size once', () => {
        symbols.length = 0;

        symbolDataURL(`2525E:${SIDC}`, 32);
        symbolDataURL(`2525E:${SIDC}`, 32);
        symbolDataURL(`2525E:${SIDC}`, 40);

        expect(symbols).toEqual([
            { sidc: SIDC, size: 32 },
            { sidc: SIDC, size: 40 },
        ]);
    });
});
