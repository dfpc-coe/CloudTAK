import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const GET = vi.fn();
const DELETE = vi.fn();
const profileGet = vi.fn();

vi.mock('../../../std.ts', () => ({
    server: {
        GET: (...args: unknown[]) => GET(...args),
        DELETE: (...args: unknown[]) => DELETE(...args),
    }
}));

vi.mock('../../../base/profile.ts', () => ({
    default: {
        get: (key: string) => profileGet(key),
        fetch: async () => { throw new Error('no api'); },
    }
}));

import PropertyCoreEntityForms from './PropertyCoreEntityForms.vue';

const FORM = {
    id: 'form-1',
    created: '2026-01-01T00:00:00.000Z',
    updated: '2026-01-01T00:00:00.000Z',
    username: 'author@example.com',
    name: 'Size-Up',
    description: '',
    schema: { type: 'object', properties: { note: { type: 'string' } } },
    channels: [1],
};

const RESPONSE = {
    id: 'response-1',
    created: '2026-01-02T00:00:00.000Z',
    updated: '2026-01-02T00:00:00.000Z',
    username: 'submitter@example.com',
    response: { note: 'hello' },
    form: FORM,
};

function identity(username: string, admin = false): void {
    profileGet.mockImplementation(async (key: string) => {
        if (key === 'username') return { key, value: username };
        if (key === 'system_admin') return { key, value: admin };
        return undefined;
    });
}

async function render() {
    GET.mockResolvedValue({ data: { total: 1, items: [RESPONSE] }, error: undefined });

    const wrapper = mount(PropertyCoreEntityForms, {
        attachTo: document.body,
        props: { event: 'event-1', channels: [1], edit: true },
    });

    await flushPromises();

    return wrapper;
}

/** Open TablerDelete's confirmation modal and confirm it */
async function confirmDelete(wrapper: Awaited<ReturnType<typeof render>>): Promise<void> {
    await wrapper.find('[title="Delete Response"]').trigger('click');
    await flushPromises();

    const confirm = document.body.querySelector('.modal .btn-danger') as HTMLElement | null;
    expect(confirm).not.toBeNull();
    confirm!.click();
    await flushPromises();
}

describe('PropertyCoreEntityForms', () => {
    beforeEach(() => {
        GET.mockReset();
        DELETE.mockReset();
        profileGet.mockReset();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('hides edit and delete for users who are neither submitter nor author', async () => {
        identity('viewer@example.com');
        const wrapper = await render();

        expect(wrapper.text()).toContain('Size-Up');
        expect(wrapper.find('[title="Edit Response"]').exists()).toBe(false);
        expect(wrapper.find('[title="Delete Response"]').exists()).toBe(false);
    });

    it('lets the submitter delete their Response and drops it from the list', async () => {
        identity('submitter@example.com');
        DELETE.mockResolvedValue({ data: { status: 200, message: 'ok' }, error: undefined });
        const wrapper = await render();

        await confirmDelete(wrapper);

        expect(DELETE).toHaveBeenCalledWith('/api/core/form/{:form}/response/{:response}', {
            params: { path: { ':form': 'form-1', ':response': 'response-1' } }
        });
        expect(wrapper.text()).not.toContain('Size-Up');
        expect(wrapper.text()).toContain('No Completed Forms');
    });

    it('lets the Form author edit a Response by emitting it', async () => {
        identity('author@example.com');
        const wrapper = await render();

        await wrapper.find('[title="Edit Response"]').trigger('click');

        expect(wrapper.emitted('edit')).toHaveLength(1);
        expect(wrapper.emitted('edit')![0][0]).toEqual(RESPONSE);
    });

    it('shows controls to System Admins', async () => {
        identity('admin@example.com', true);
        const wrapper = await render();

        expect(wrapper.find('[title="Edit Response"]').exists()).toBe(true);
    });

    it('surfaces a failed delete without removing the row', async () => {
        identity('submitter@example.com');
        DELETE.mockResolvedValue({ data: undefined, error: { status: 403, message: 'Nope' } });
        const wrapper = await render();

        await confirmDelete(wrapper);

        expect(wrapper.text()).toContain('Nope');
        expect(wrapper.text()).toContain('Size-Up');
    });
});
