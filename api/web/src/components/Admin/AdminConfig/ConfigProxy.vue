<template>
    <SlideDownHeader
        v-model='isOpen'
        label='Plugin Proxy'
    >
        <template #right>
            <TablerIconButton
                v-if='!edit && isOpen'
                title='Edit'
                @click.stop='edit = true'
            >
                <IconPencil stroke='1' />
            </TablerIconButton>
            <div
                v-else-if='edit && isOpen'
                class='d-flex gap-1'
            >
                <TablerIconButton
                    color='blue'
                    title='Save'
                    @click.stop='save'
                >
                    <IconDeviceFloppy stroke='1' />
                </TablerIconButton>
                <TablerIconButton
                    color='red'
                    title='Cancel'
                    @click.stop='edit = false; fetch()'
                >
                    <IconX stroke='1' />
                </TablerIconButton>
            </div>
        </template>
        <div class='col-lg-12 py-2 px-2 border rounded'>
            <TablerLoading v-if='loading' />
            <template v-else>
                <TablerAlert
                    v-if='err'
                    :err='err'
                />

                <div class='row'>
                    <div class='col-lg-12'>
                        <TablerToggle
                            v-model='config["proxy::enabled"]'
                            :disabled='!edit'
                            label='Enable Plugin Proxy'
                        />

                        <p class='text-secondary mt-2 mb-2'>
                            Allow plugins to make outbound requests through CloudTAK. Only exact origins in the whitelist are allowed.
                        </p>

                        <TagEntry
                            v-model='config["proxy::whitelist"]'
                            :disabled='!edit'
                            :validate='validateOrigin'
                            placeholder='https://api.example.com'
                            :add-tag-on-blur='true'
                        />

                        <div class='text-secondary small mt-2'>
                            Enter one origin per tag, such as https://api.example.com or https://api.example.com:8443. Paths, query strings, credentials, and fragments are not allowed.
                        </div>
                    </div>
                </div>
            </template>
        </div>
    </SlideDownHeader>
</template>

<script setup lang="ts">
import SlideDownHeader from '../../CloudTAK/util/SlideDownHeader.vue';
import TagEntry from '../../CloudTAK/util/TagEntry.vue';
import { ref, watch, onMounted } from 'vue';
import { std, stdurl } from '../../../std.ts';
import {
    TablerLoading,
    TablerToggle,
    TablerIconButton,
    TablerAlert
} from '@tak-ps/vue-tabler';
import {
    IconPencil,
    IconDeviceFloppy,
    IconX
} from '@tabler/icons-vue';

type ProxyConfig = {
    'proxy::enabled': boolean;
    'proxy::whitelist': string[];
}

const isOpen = ref(false);
const loading = ref(false);
const edit = ref(false);
const err = ref<Error | null>(null);

const config = ref<ProxyConfig>({
    'proxy::enabled': false,
    'proxy::whitelist': [],
});

onMounted(() => {
    if (isOpen.value) fetch();
});

watch(isOpen, (newState) => {
    if (newState && !edit.value) fetch();
});

function validateOrigin(value: string): string {
    if (!value.trim()) return 'Origin cannot be empty';

    let parsed: URL;
    try {
        parsed = new URL(value.trim());
    } catch (err) {
        return err instanceof Error ? err.message : String(err);
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        return 'Origin must start with http:// or https://';
    }

    if (parsed.username || parsed.password) {
        return 'Origins cannot include credentials';
    }

    if (parsed.pathname && parsed.pathname !== '/') {
        return 'Origins cannot include a path';
    }

    if (parsed.search) return 'Origins cannot include query parameters';
    if (parsed.hash) return 'Origins cannot include fragments';
    if (parsed.origin !== value.trim().replace(/\/$/, '')) {
        return 'Enter only the origin (scheme, host, optional port)';
    }

    return '';
}

async function fetch() {
    loading.value = true;
    err.value = null;

    try {
        const url = stdurl('/api/config');
        url.searchParams.set('keys', Object.keys(config.value).join(','));
        const res = await std(url) as Partial<ProxyConfig>;

        config.value['proxy::enabled'] = Boolean(res['proxy::enabled']);
        config.value['proxy::whitelist'] = Array.isArray(res['proxy::whitelist'])
            ? res['proxy::whitelist'].map((entry) => String(entry))
            : [];
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
    }

    loading.value = false;
}

async function save() {
    loading.value = true;
    err.value = null;

    try {
        await std('/api/config', {
            method: 'PUT',
            body: {
                'proxy::enabled': config.value['proxy::enabled'],
                'proxy::whitelist': config.value['proxy::whitelist'].map((entry) => entry.trim()).filter(Boolean)
            }
        });

        edit.value = false;
        await fetch();
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
        console.error('Failed to save proxy config:', error);
    }

    loading.value = false;
}
</script>