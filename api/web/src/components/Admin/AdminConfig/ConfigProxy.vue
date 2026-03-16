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
                    <IconDeviceFloppy color='white' stroke='1' />
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

                        <template v-if='config["proxy::enabled"]'>
                            <p class='text-secondary mt-2 mb-2'>
                                Allow plugins to make outbound requests through CloudTAK. Configure the whitelist as an array of allowed URLs.
                            </p>

                            <div class='d-flex align-items-center justify-content-between mb-2'>
                                <label class='form-label mb-0'>Allowed URLs</label>

                                <TablerIconButton
                                    v-if='edit'
                                    color='blue'
                                    title='Add URL'
                                    @click='addWhitelistEntry()'
                                >
                                    <IconPlus stroke='1' />
                                </TablerIconButton>
                            </div>

                            <template v-if='config["proxy::whitelist"].length'>
                                <div
                                    v-for='(url, index) in config["proxy::whitelist"]'
                                    :key='index'
                                    class='d-flex gap-2 align-items-center mb-2'
                                >
                                    <div class='flex-grow-1'>
                                        <TablerInput
                                            v-model='config["proxy::whitelist"][index]'
                                            :disabled='!edit'
                                            :error='validateOptionalProxyURL(url)'
                                            placeholder='https://api.example.com/v1'
                                        />
                                    </div>

                                    <TablerIconButton
                                        v-if='edit'
                                        color='red'
                                        title='Remove URL'
                                        @click='removeWhitelistEntry(index)'
                                    >
                                        <IconTrash stroke='1' />
                                    </TablerIconButton>
                                </div>
                            </template>

                            <TablerNone
                                v-else
                                label='No proxy URLs configured'
                                :create='false'
                            />
                        </template>
                    </div>
                </div>
            </template>
        </div>
    </SlideDownHeader>
</template>

<script setup lang="ts">
import SlideDownHeader from '../../CloudTAK/util/SlideDownHeader.vue';
import { ref, watch, onMounted } from 'vue';
import { std, stdurl } from '../../../std.ts';
import {
    TablerLoading,
    TablerNone,
    TablerInput,
    TablerToggle,
    TablerIconButton,
    TablerAlert
} from '@tak-ps/vue-tabler';
import {
    IconPencil,
    IconDeviceFloppy,
    IconPlus,
    IconTrash,
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

function validateProxyURL(value: string): string {
    if (!value.trim()) return 'URL cannot be empty';

    let parsed: URL;
    try {
        parsed = new URL(value.trim());
    } catch (err) {
        return err instanceof Error ? err.message : String(err);
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        return 'URL must start with http:// or https://';
    }

    if (parsed.username || parsed.password) {
        return 'URLs cannot include credentials';
    }

    if (parsed.hash) return 'URLs cannot include fragments';

    return '';
}

function validateOptionalProxyURL(value: string): string {
    if (!value.trim()) return '';
    return validateProxyURL(value);
}

function addWhitelistEntry(): void {
    config.value['proxy::whitelist'].push('');
}

function removeWhitelistEntry(index: number): void {
    config.value['proxy::whitelist'].splice(index, 1);
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