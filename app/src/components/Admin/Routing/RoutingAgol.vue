<template>
    <SlideDownHeader
        v-model='isOpen'
        label='ArcGIS Online'
    >
        <template #icon>
            <IconWorld
                :size='18'
                stroke='1'
                color='#6b7990'
                class='ms-2 me-1'
            />
        </template>
        <template #right>
            <RoutingStatus
                class='me-2'
                :status='props.status'
            />
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
        <div class='col-lg-12 py-2 px-2'>
            <TablerLoading v-if='loading' />
            <template v-else>
                <TablerAlert
                    v-if='err'
                    :err='err'
                />
                <div class='row'>
                    <div class='col-lg-12'>
                        <TablerToggle
                            v-model='config["routing::agol::enabled"]'
                            :disabled='!edit'
                            label='ArcGIS Online Routing Enabled'
                        />

                        <template v-if='config["routing::agol::enabled"]'>
                            <TablerPillGroup
                                v-model='config["routing::agol::auth_method"]'
                                :options='[
                                    { value: "oauth2", label: "OAuth2" },
                                    { value: "legacy", label: "Legacy" }
                                ]'
                                :disabled='!config["routing::agol::enabled"] || !edit'
                                size='default'
                            />

                            <template v-if='config["routing::agol::auth_method"] === "oauth2"'>
                                <TablerInput
                                    v-model='config["routing::agol::client_id"]'
                                    :disabled='!edit'
                                    label='OAuth2 Client ID'
                                    description='Client ID from your ArcGIS Location Platform or ArcGIS Enterprise account'
                                />
                                <TablerInput
                                    v-model='config["routing::agol::client_secret"]'
                                    type='password'
                                    autocomplete='new-password'
                                    :disabled='!edit'
                                    label='OAuth2 Client Secret'
                                    description='Client Secret from your ArcGIS Location Platform or ArcGIS Enterprise account'
                                />
                            </template>
                            <template v-else>
                                <TablerInput
                                    v-model='config["routing::agol::token"]'
                                    type='password'
                                    autocomplete='new-password'
                                    :disabled='!edit'
                                    label='Legacy Token'
                                    description='ArcGIS Online access token'
                                />
                            </template>
                        </template>
                    </div>
                </div>
            </template>
        </div>
    </SlideDownHeader>
</template>

<script setup lang="ts">
import SlideDownHeader from '../../CloudTAK/util/SlideDownHeader.vue';
import RoutingStatus from './RoutingStatus.vue';
import type { RoutingProviderStatus } from '../../../types.ts';
import { ref, watch, onMounted } from 'vue';
import { server } from '../../../std.ts';
import {
    TablerLoading,
    TablerInput,
    TablerToggle,
    TablerIconButton,
    TablerAlert,
    TablerPillGroup
} from '@tak-ps/vue-tabler';
import {
    IconPencil,
    IconDeviceFloppy,
    IconX,
    IconWorld
} from '@tabler/icons-vue';

interface RoutingAgolConfig {
    'routing::agol::enabled': boolean;
    'routing::agol::auth_method': 'oauth2' | 'legacy';
    'routing::agol::token': string;
    'routing::agol::client_id': string;
    'routing::agol::client_secret': string;
}

const props = defineProps<{
    status?: RoutingProviderStatus;
}>();

const isOpen = ref<boolean>(false);
const loading = ref<boolean>(false);
const edit = ref<boolean>(false);
const err = ref<Error | null>(null);

const config = ref<RoutingAgolConfig>({
    'routing::agol::enabled': false,
    'routing::agol::auth_method': 'oauth2',
    'routing::agol::token': '',
    'routing::agol::client_id': '',
    'routing::agol::client_secret': '',
});

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
            'routing::agol::enabled': data['routing::agol::enabled'] ?? false,
            'routing::agol::auth_method': data['routing::agol::auth_method'] ?? 'oauth2',
            'routing::agol::token': data['routing::agol::token'] ?? '',
            'routing::agol::client_id': data['routing::agol::client_id'] ?? '',
            'routing::agol::client_secret': data['routing::agol::client_secret'] ?? '',
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
        console.error('Failed to save AGOL Routing config:', error);
    }
    loading.value = false;
}
</script>
