<template>
    <SlideDownHeader
        v-model='isOpen'
        label='SCIM User Provisioning'
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
                        <TablerToggle
                            v-model='config["scim::enabled"]'
                            :disabled='!edit'
                            label='Enable Incoming SCIM 2.0 Provisioning'
                        />
                    </div>

                    <template v-if='config["scim::enabled"]'>
                        <div class='col-lg-12'>
                            <p class='text-secondary mt-2 mb-2'>
                                Allow an Identity Provider (Okta, Entra ID, etc.) to create, update and deactivate CloudTAK users. Configure the Identity Provider with the SCIM Base URL and the Bearer Token below.
                            </p>
                        </div>
                        <div class='col-lg-12 mb-2'>
                            <CopyField
                                label='SCIM Base URL'
                                :model-value='scimUrl'
                            />
                        </div>
                        <div class='col-lg-12'>
                            <div class='d-flex align-items-end gap-1'>
                                <div class='flex-grow-1'>
                                    <TablerInput
                                        v-model='config["scim::token"]'
                                        type='password'
                                        autocomplete='new-password'
                                        :disabled='!edit'
                                        label='SCIM Bearer Token'
                                    />
                                </div>
                                <TablerIconButton
                                    v-if='edit'
                                    class='mb-1'
                                    title='Generate Token'
                                    @click.stop='generate'
                                >
                                    <IconRefresh stroke='1' />
                                </TablerIconButton>
                            </div>
                        </div>
                    </template>
                </div>
            </template>
        </div>
    </SlideDownHeader>
</template>

<script setup lang="ts">
import SlideDownHeader from '../../CloudTAK/util/SlideDownHeader.vue';
import CopyField from '../../CloudTAK/util/CopyField.vue';
import { ref, computed, watch, onMounted } from 'vue';
import { server, stdurl } from '../../../std.ts';
import {
    TablerLoading,
    TablerInput,
    TablerToggle,
    TablerIconButton,
    TablerAlert
} from '@tak-ps/vue-tabler';
import {
    IconPencil,
    IconDeviceFloppy,
    IconRefresh,
    IconX
} from '@tabler/icons-vue';

interface ScimConfig {
    'scim::enabled': boolean;
    'scim::token': string;
}

const isOpen = ref<boolean>(false);
const loading = ref<boolean>(false);
const edit = ref<boolean>(false);
const err = ref<Error | null>(null);

const config = ref<ScimConfig>({
    'scim::enabled': false,
    'scim::token': '',
});

const scimUrl = computed(() => String(stdurl('/api/scim/v2')));

onMounted(() => {
    if (isOpen.value) void fetch();
});

watch(isOpen, (newState) => {
    if (newState && !edit.value) void fetch();
});

function generate(): void {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    config.value['scim::token'] = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

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
            'scim::enabled': data['scim::enabled'] ?? false,
            'scim::token': data['scim::token'] ?? '',
        };
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
    }
    loading.value = false;
}

async function save(): Promise<void> {
    if (config.value['scim::enabled'] && !config.value['scim::token']) {
        err.value = new Error('A SCIM Bearer Token is required when SCIM is enabled');
        return;
    }

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
        console.error('Failed to save SCIM config:', error);
    }
    loading.value = false;
}
</script>
