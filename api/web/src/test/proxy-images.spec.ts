import { describe, it, expect } from 'vitest';
import { proxyHtmlImages, featureHtmlDescription } from '../components/CloudTAK/util/proxyImages.ts';
import { stdurl } from '../std.ts';

describe('proxyHtmlImages', () => {
    it('rewrites remote image sources through the proxy with a token', () => {
        const html = '<p>AQI</p><img src="https://files.airnowtech.org/airnow/today/aqi.png" alt="AQI">';
        const out = proxyHtmlImages(html, 'abc123');

        const doc = new DOMParser().parseFromString(out, 'text/html');
        const img = doc.querySelector('img');
        expect(img).not.toBeNull();

        const src = new URL(img!.getAttribute('src')!);
        expect(src.pathname).toBe('/api/proxy/image');
        expect(src.searchParams.get('url')).toBe('https://files.airnowtech.org/airnow/today/aqi.png');
        expect(src.searchParams.get('token')).toBe('abc123');
        expect(img!.getAttribute('alt')).toBe('AQI');
        expect(doc.querySelector('p')?.textContent).toBe('AQI');
    });

    it('omits the token when none is available', () => {
        const out = proxyHtmlImages('<img src="http://example.com/a.png">');
        const src = new URL(new DOMParser().parseFromString(out, 'text/html').querySelector('img')!.getAttribute('src')!);
        expect(src.searchParams.get('url')).toBe('http://example.com/a.png');
        expect(src.searchParams.has('token')).toBe(false);
    });

    it('leaves relative, data and same-origin sources alone', () => {
        const same = `${stdurl('/').origin}/api/attachment/abc`;
        const html = `<img src="/icons/a.png"><img src="data:image/png;base64,AAAA"><img src="${same}">`;
        const out = proxyHtmlImages(html, 'abc123');

        const srcs = Array.from(new DOMParser().parseFromString(out, 'text/html').querySelectorAll('img')).map(i => i.getAttribute('src'));
        expect(srcs).toEqual(['/icons/a.png', 'data:image/png;base64,AAAA', same]);
    });

    it('returns html without images unchanged', () => {
        expect(proxyHtmlImages('<b>hello</b> world')).toBe('<b>hello</b> world');
    });
});

describe('featureHtmlDescription', () => {
    it('proxies images inside an html typed description', () => {
        const description = JSON.stringify({ '@type': 'html', value: '<img src="https://files.airnowtech.org/a.png">' });
        const out = featureHtmlDescription({ description }, 'tok');
        expect(out).not.toBeNull();
        const src = new URL(new DOMParser().parseFromString(out!, 'text/html').querySelector('img')!.getAttribute('src')!);
        expect(src.pathname).toBe('/api/proxy/image');
        expect(src.searchParams.get('url')).toBe('https://files.airnowtech.org/a.png');
        expect(src.searchParams.get('token')).toBe('tok');
    });

    it('returns null for plain or non-html descriptions', () => {
        expect(featureHtmlDescription({ description: 'just text' })).toBeNull();
        expect(featureHtmlDescription({ description: JSON.stringify({ '@type': 'text', value: 'x' }) })).toBeNull();
        expect(featureHtmlDescription({})).toBeNull();
        expect(featureHtmlDescription(null)).toBeNull();
    });
});
