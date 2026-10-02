import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { TablerMarkdown } from '@tak-ps/vue-tabler';

import { textToMarkdown } from './text-markdown.ts';

function render(text: string): string {
    // html() pretty prints which would alter the line breaks under test
    return (mount(TablerMarkdown, {
        props: { markdown: textToMarkdown(text), autowrap: false }
    }).element as HTMLElement).outerHTML;
}

describe('textToMarkdown', () => {
    it('keeps line structure so plain text line breaks survive', () => {
        expect(textToMarkdown('line one\r\nline two\n\nline four')).toBe('line one\nline two\n\nline four');
        expect(render('line one\nline two')).toContain('<p>line one\nline two</p>');
    });

    it('renders a table', () => {
        const html = render([
            '**Groups:** EN31',
            '',
            '| Time | Author | Note |',
            '| --- | --- | --- |',
            '| 13:21:10 | jdoe | GATE CODE 12\\|34 |'
        ].join('\n'));

        expect(html).toContain('<strong>Groups:</strong> EN31');
        expect(html).toContain('<th>Author</th>');
        expect(html).toContain('<td>GATE CODE 12|34</td>');
    });

    it('does not render text from an indented template as a code block', () => {
        const text = `
            Groups: EN31
            Author: CAD
              nested
        `;

        expect(textToMarkdown(text)).toBe('Groups: EN31\nAuthor: CAD\n  nested');
        expect(render(text)).not.toContain('<pre>');
    });

    it('renders indented HTML with blank lines as HTML, not a code block', () => {
        // KML description as delivered by the AirNow NetworkLink feed
        const text = [
            '\t\t\t<div align="center">',
            '\t\t\t\t<table border="0">',
            '\t\t\t\t\t<tr>',
            '\t\t\t\t\t\t<td colspan="2">',
            '\t\t\t\t\t\t\t<b><font color="#0f79b9" size="5">AIR&nbsp;QUALITY&nbsp;INFORMATION</font></b>',
            '',
            '\t\t\t\t\t\t</td>',
            '\t\t\t\t\t</tr>',
            '\t\t\t\t\t<tr>',
            '\t\t\t\t\t\t<td><a href="http://www.airnow.gov/">National Air Quality</a></td>',
            '\t\t\t\t\t</tr>',
            '\t\t\t\t</table>',
            '\t\t\t</div>'
        ].join('\n');

        const html = render(text);

        expect(html).not.toContain('<pre>');
        expect(html).not.toContain('&lt;');
        expect(html).toContain('<a href="http://www.airnow.gov/">National Air Quality</a>');
        expect(html).toContain('AIR&nbsp;QUALITY&nbsp;INFORMATION');
    });

    it('links bare URLs', () => {
        expect(textToMarkdown('see https://example.com/a?b=1 now')).toBe('see [https://example.com/a?b=1](https://example.com/a?b=1) now');
        expect(textToMarkdown('| https://example.com |')).toBe('| [https://example.com](https://example.com) |');
    });

    it('leaves existing Markdown links & code fences alone', () => {
        expect(textToMarkdown('[docs](https://example.com)')).toBe('[docs](https://example.com)');
        expect(textToMarkdown('<https://example.com>')).toBe('<https://example.com>');
        expect(textToMarkdown('```\nhttps://example.com\n```')).toBe('```\nhttps://example.com\n```');
    });

    it('sanitizes HTML', () => {
        expect(render('<img src=x onerror=alert(1)>')).not.toContain('onerror');
    });

    it('handles empty values', () => {
        expect(textToMarkdown(undefined)).toBe('');
        expect(textToMarkdown('')).toBe('');
        expect(textToMarkdown(42)).toBe('42');
    });
});
