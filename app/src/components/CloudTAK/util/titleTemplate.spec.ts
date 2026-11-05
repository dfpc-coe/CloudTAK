import { afterEach, describe, expect, it, vi } from 'vitest';
import Handlebars from 'handlebars';
vi.mock('../../../std.ts', () => ({ server: { GET: vi.fn() } }));

import { featureTitle, renderTitleTemplate } from './titleTemplate.ts';

const props = {
    eventType: 'Road Work',
    locationArea: 'SH 82 14km west of Ikawai',
    callsign: 'ALPHA',
    name: 'Tom & Jerry',
    html: '<table><tr><td>Speed</td><td>50</td></tr></table>',
    evil: '<scr<script>ipt>alert(1)</script> <b onclick="x">ok</b>',
    depth: 12.3456,
    nested: { label: 'Inner' },
    empty: ''
};

describe('renderTitleTemplate', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('renders without compiling to JavaScript', () => {
        vi.stubGlobal('Function', function () {
            throw new EvalError('Code generation from strings disallowed for this context');
        });

        expect(() => Handlebars.compile('{{eventType}}')(props)).toThrow(EvalError);
        expect(renderTitleTemplate('{{eventType}}: {{locationArea}}', props))
            .toBe('Road Work: SH 82 14km west of Ikawai');
    });

    it('wraps a bare property name', () => {
        expect(renderTitleTemplate('callsign', props)).toBe('ALPHA');
    });

    it('does not HTML-escape values', () => {
        expect(renderTitleTemplate('{{name}}', props)).toBe('Tom & Jerry');
    });

    it('resolves nested paths and this', () => {
        expect(renderTitleTemplate('{{nested.label}}', props)).toBe('Inner');
        expect(renderTitleTemplate('{{this.callsign}}', props)).toBe('ALPHA');
        expect(renderTitleTemplate('{{missing.deeper}}', props)).toBeNull();
    });

    it('returns null when the template renders to nothing', () => {
        expect(renderTitleTemplate('', props)).toBeNull();
        expect(renderTitleTemplate('  {{empty}} ', props)).toBeNull();
        expect(renderTitleTemplate('{{missing}}', props)).toBeNull();
    });

    it('supports the server-side helpers', () => {
        expect(renderTitleTemplate('{{fallback empty missing callsign}}', props)).toBe('ALPHA');
        expect(renderTitleTemplate('{{slice locationArea 0 5}}', props)).toBe('SH 82');
        expect(renderTitleTemplate('{{slice locationArea 6}}', props)).toBe('14km west of Ikawai');
        expect(renderTitleTemplate('{{htmlstrip html}}', props)).toBe('Speed: 50:');
        expect(renderTitleTemplate('{{htmlstrip evil}}', props)).toBe('ipt>alert(1) ok');
        expect(renderTitleTemplate('{{replace locationArea "km" " km"}}', props)).toBe('SH 82 14 km west of Ikawai');
        expect(renderTitleTemplate('{{round depth}}', props)).toBe('12.35');
        expect(renderTitleTemplate('{{round depth 1}}m', props)).toBe('12.3m');
    });

    it('evaluates sub-expressions and literals', () => {
        expect(renderTitleTemplate('{{fallback (slice empty 0) "Unknown"}}', props)).toBe('Unknown');
        expect(renderTitleTemplate('{{replace (replace name "&" "and") "Tom" "T"}}', props)).toBe('T and Jerry');
    });

    it('ignores comments', () => {
        expect(renderTitleTemplate('{{! note }}{{callsign}}', props)).toBe('ALPHA');
    });

    it('throws on unsupported constructs', () => {
        expect(() => renderTitleTemplate('{{#if callsign}}x{{/if}}', props)).toThrow();
        expect(() => renderTitleTemplate('{{> partial}}', props)).toThrow();
        expect(() => renderTitleTemplate('{{unknownHelper callsign}}', props)).toThrow();
        expect(() => renderTitleTemplate('{{callsign key=1}}', props)).toThrow();
        expect(() => renderTitleTemplate('{{../callsign}}', props)).toThrow();
        expect(() => renderTitleTemplate('{{@index}}', props)).toThrow();
        expect(() => renderTitleTemplate('{{callsign', props)).toThrow();
    });
});

describe('featureTitle', () => {
    it('prefers the template, then name, then callsign, then the fallback', () => {
        expect(featureTitle(props, '{{eventType}}')).toBe('Road Work');
        expect(featureTitle(props, null)).toBe('Tom & Jerry');
        expect(featureTitle({ callsign: 'BRAVO' }, '{{missing}}')).toBe('BRAVO');
        expect(featureTitle({}, null)).toBe('No Name');
        expect(featureTitle(null, null, '')).toBe('');
    });

    it('warns and falls back when the template cannot render', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(featureTitle(props, '{{#if x}}{{/if}}')).toBe('Tom & Jerry');
        expect(warn).toHaveBeenCalledOnce();
        warn.mockRestore();
    });
});
