<template>
    <SlideDownHeader
        v-model='isOpen'
        label='Media Server'
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
                    color='rgba(var(--tblr-primary-rgb), 0.14)'
                    title='Save'
                    @click.stop='save'
                >
                    <IconDeviceFloppy
                        color='rgb(var(--tblr-primary-rgb))'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerIconButton
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
                        <TablerInput
                            v-model='config["media::url"]'
                            :disabled='!edit'
                            :error='validateURL(config["media::url"])'
                            label='CloudTAK Hosted MediaMTX Service URL'
                        />
                    </div>
                    <div class='col-lg-12 mt-3'>
                        <div class='d-flex align-items-center justify-content-between mb-2'>
                            <label class='form-label mb-0'>Trusted Proxy Sources</label>

                            <TablerIconButton
                                v-if='edit'
                                title='Add Source'
                                @click='addProxyAllowEntry()'
                            >
                                <IconPlus
                                    color='rgb(var(--tblr-primary-rgb))'
                                    stroke='1'
                                />
                            </TablerIconButton>
                        </div>
                        <p class='text-secondary'>
                            Hostnames or origins (scheme + host + optional port) of video proxy sources on private
                            networks that should bypass SSRF protection when creating a video lease proxy.
                        </p>

                        <template v-if='config["media::proxy::allow"].length'>
                            <div
                                v-for='(host, index) in config["media::proxy::allow"]'
                                :key='index'
                                class='d-flex gap-2 align-items-center mb-2'
                            >
                                <div class='flex-grow-1'>
                                    <TablerInput
                                        v-model='config["media::proxy::allow"][index]'
                                        :disabled='!edit'
                                        placeholder='camera.internal or http://10.0.0.5:8554'
                                    />
                                </div>

                                <TablerIconButton
                                    v-if='edit'
                                    title='Remove Source'
                                    @click='removeProxyAllowEntry(index)'
                                >
                                    <IconTrash
                                        color='rgb(var(--tblr-danger-rgb))'
                                        stroke='1'
                                    />
                                </TablerIconButton>
                            </div>
                        </template>

                        <TablerNone
                            v-else
                            label='No trusted proxy sources configured'
                            :create='false'
                        />
                    </div>
                </div>
            </template>
        </div>
    </SlideDownHeader>
</template>

<script setup lang="ts">
import SlideDownHeader from '../../CloudTAK/util/SlideDownHeader.vue';
import { ref, watch, onMounted } from 'vue';
import { server } from '../../../std.ts';
import { validateURL } from '../../../base/validators.ts';
import {
    TablerLoading,
    TablerNone,
    TablerInput,
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

interface MediaConfig {
    'media::url': string;
    'media::proxy::allow': string[];
}

const isOpen = ref<boolean>(false);
const loading = ref<boolean>(false);
const edit = ref<boolean>(false);
const err = ref<Error | null>(null);

const config = ref<MediaConfig>({
    'media::url': '',
    'media::proxy::allow': [],
});

function addProxyAllowEntry(): void {
    config.value['media::proxy::allow'].push('');
}

function removeProxyAllowEntry(index: number): void {
    config.value['media::proxy::allow'].splice(index, 1);
}

onMounted(() => {
     if (isOpen.value) void fetch();
});

watch(isOpen, (newState) => {
    if (newState && !edit.value) void fetch();
});

async function fetch(): Promise<void> {
    loading.value = true;
    err.value = null;
    try {
        const { data, error } = await server.GET('/api/config', {
            params: {
                query: {
                    keys: Object.keys(config.value).join(',')
                }
            }
        });
        if (error) throw new Error(error.message);
        config.value = {
            'media::url': data['media::url'] ?? '',
            'media::proxy::allow': data['media::proxy::allow'] ?? [],
        };
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
    }
    loading.value = false;
}

async function save(): Promise<void> {
    loading.value = true;
    err.value = null;
    try {
        const { error } = await server.PUT('/api/config', {
            body: config.value
        });
        if (error) throw new Error(error.message);
        edit.value = false;
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
        console.error('Failed to save Media config:', error);
    }
    loading.value = false;
}
</script>
