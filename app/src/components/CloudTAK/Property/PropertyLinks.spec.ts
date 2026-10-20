import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../std.ts', () => ({
    getRuntimeToken: async () => 'abc123',
    stdurl: (path: string) => new URL(path, 'http://localhost:8080'),
}));

import PropertyLinks from './PropertyLinks.vue';
import type COT from '../../../base/cot';

function cot(links: Array<Record<string, string>>): COT {
    return {
        properties: { links },
        update: vi.fn(),
    } as unknown as COT;
}

async function render(links: Array<Record<string, string>>) {
    const wrapper = mount(PropertyLinks, {
        props: { cot: cot(links) },
    });

    await flushPromises();

    // Thumbnails only load while the section is expanded
    await wrapper.find('.slidedown__header').trigger('click');
    await flushPromises();

    return wrapper;
}

describe('PropertyLinks', () => {
    it('renders image links as thumbnails through the image proxy', async () => {
        const wrapper = await render([{
            uid: 'alertwest-cam-image',
            relation: 'r-u',
            mime: 'image/jpeg',
            url: 'https://img.cdn.prod.alertwest.com/data/img/latest.jpg',
            remarks: 'Latest Image',
        }]);

        const img = wrapper.find('img.link-thumb');
        expect(img.exists()).toBe(true);

        const src = new URL(img.attributes('src')!);
        expect(src.pathname).toBe('/api/proxy/image');
        expect(src.searchParams.get('url')).toBe('https://img.cdn.prod.alertwest.com/data/img/latest.jpg');
        expect(src.searchParams.get('token')).toBe('abc123');
        expect(img.attributes('alt')).toBe('Latest Image');
        expect(wrapper.find('a[href="https://img.cdn.prod.alertwest.com/data/img/latest.jpg"]').exists()).toBe(true);
    });

    it('detects images by URL extension when no mime is given', async () => {
        const wrapper = await render([{
            relation: 'r-u',
            url: 'https://example.com/photo.PNG?size=large',
        }]);

        expect(wrapper.find('img.link-thumb').exists()).toBe(true);
    });

    it('renders non-image links without a thumbnail', async () => {
        const wrapper = await render([{
            relation: 'r-u',
            url: 'https://example.com/report',
            remarks: 'Report',
        }]);

        expect(wrapper.find('img.link-thumb').exists()).toBe(false);
        expect(wrapper.text()).toContain('Report');
    });

    it('falls back to the plain link when the thumbnail fails to load', async () => {
        const wrapper = await render([{
            relation: 'r-u',
            mime: 'image/jpeg',
            url: 'https://example.com/missing.jpg',
        }]);

        await wrapper.find('img.link-thumb').trigger('error');
        await flushPromises();

        expect(wrapper.find('img.link-thumb').exists()).toBe(false);
        expect(wrapper.find('a[href="https://example.com/missing.jpg"]').exists()).toBe(true);
    });
});
