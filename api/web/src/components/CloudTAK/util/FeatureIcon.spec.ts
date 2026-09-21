import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../base/cot.ts', () => ({ renderedIcon: () => undefined }));
vi.mock('../../../stores/map.ts', () => ({ useMapStore: () => ({ _map: undefined }) }));

import FeatureIcon from './FeatureIcon.vue';

const feature = {
    properties: { type: 'u-d-p' },
    geometry: { type: 'Point', coordinates: [0, 0] },
};

describe('FeatureIcon', () => {
    it('only overlays the error marker when error is set', async () => {
        const wrapper = mount(FeatureIcon, { props: { feature } });

        expect(wrapper.find('.feature-icon__error').exists()).toBe(false);

        await wrapper.setProps({ error: true });

        expect(wrapper.find('.feature-icon__error').exists()).toBe(true);
    });
});
