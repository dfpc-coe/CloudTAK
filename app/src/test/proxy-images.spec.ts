import { describe, it, expect } from 'vitest';
import { proxyHtmlImages, featureHtmlDescription } from '../components/CloudTAK/util/proxyImages.ts';
import { stdurl } from '../std.ts';

function imgs(html: string) {
    const template = document.createElement('template');
    template.innerHTML = html;
    return Array.from(template.content.querySelectorAll('img'));
}

describe('proxyHtmlImages', () => {
    it('rewrites remote image sources through the proxy with a token', () => {
        const html = '<p>AQI</p><img src="https://files.airnowtech.org/airnow/today/aqi.png" alt="AQI">';
        const out = proxyHtmlImages(html, 'abc123');

        const [img] = imgs(out);
        expect(img).toBeDefined();

        const src = new URL(img.getAttribute('src')!);
        expect(src.pathname).toBe('/api/proxy/image');
        expect(src.searchParams.get('url')).toBe('https://files.airnowtech.org/airnow/today/aqi.png');
        expect(src.searchParams.get('token')).toBe('abc123');
        expect(img.getAttribute('alt')).toBe('AQI');
        expect(out.startsWith('<p>AQI</p>')).toBe(true);
    });

    it('omits the token when none is available', () => {
        const out = proxyHtmlImages('<img src="http://example.com/a.png">');
        const src = new URL(imgs(out)[0].getAttribute('src')!);
        expect(src.searchParams.get('url')).toBe('http://example.com/a.png');
        expect(src.searchParams.has('token')).toBe(false);
    });

    it('leaves relative, data and same-origin sources alone', () => {
        const same = `${stdurl('/').origin}/api/attachment/abc`;
        const html = `<img src="/icons/a.png"><img src="data:image/png;base64,AAAA"><img src="${same}">`;
        const out = proxyHtmlImages(html, 'abc123');

        expect(imgs(out).map(i => i.getAttribute('src'))).toEqual(['/icons/a.png', 'data:image/png;base64,AAAA', same]);
    });

    it('returns html without images unchanged', () => {
        const html = '<style>.x{color:red}</style><b>hello</b> &amp; world';
        expect(proxyHtmlImages(html)).toBe(html);
    });

    it('preserves leading head elements alongside rewritten images', () => {
        const out = proxyHtmlImages('<style>.x{color:red}</style><title>t</title><img src="https://example.com/a.png">', 'tok');
        expect(out.startsWith('<style>.x{color:red}</style><title>t</title>')).toBe(true);
        expect(new URL(imgs(out)[0].getAttribute('src')!).pathname).toBe('/api/proxy/image');
    });
});

describe('featureHtmlDescription', () => {
    it('returns the raw value of an html typed description', () => {
        const value = '<img src="https://files.airnowtech.org/a.png">';
        const description = JSON.stringify({ '@type': 'html', value });
        expect(featureHtmlDescription({ description })).toBe(value);
    });

    it('returns null for plain or non-html descriptions', () => {
        expect(featureHtmlDescription({ description: 'just text' })).toBeNull();
        expect(featureHtmlDescription({ description: JSON.stringify({ '@type': 'text', value: 'x' }) })).toBeNull();
        expect(featureHtmlDescription({ description: JSON.stringify({ '@type': 'html', value: 5 }) })).toBeNull();
        expect(featureHtmlDescription({ description: 'null' })).toBeNull();
        expect(featureHtmlDescription({})).toBeNull();
        expect(featureHtmlDescription(null)).toBeNull();
    });
});
