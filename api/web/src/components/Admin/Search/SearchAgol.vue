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
            <SearchStatus
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
                            v-model='config["search::agol::enabled"]'
                            :disabled='!edit'
                            label='ArcGIS Online Enabled'
                        />

                        <template v-if='config["search::agol::enabled"]'>
                            <TablerPillGroup
                                v-model='config["search::agol::auth_method"]'
                                :options='[
                                    { value: "oauth2", label: "OAuth2" },
                                    { value: "legacy", label: "Legacy" }
                                ]'
                                :disabled='!config["search::agol::enabled"] || !edit'
                                size='default'
                            />

                            <template v-if='config["search::agol::auth_method"] === "oauth2"'>
                                <TablerInput
                                    v-model='config["search::agol::client_id"]'
                                    :disabled='!edit'
                                    label='OAuth2 Client ID'
                                    description='Client ID from your ArcGIS Location Platform or ArcGIS Enterprise account'
                                />
                                <TablerInput
                                    v-model='config["search::agol::client_secret"]'
                                    type='password'
                                    autocomplete='new-password'
                                    :disabled='!edit'
                                    label='OAuth2 Client Secret'
                                    description='Client Secret from your ArcGIS Location Platform or ArcGIS Enterprise account'
                                />
                            </template>
                            <template v-else>
                                <TablerInput
                                    v-model='config["search::agol::token"]'
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
import SearchStatus from './SearchStatus.vue';
import type { SearchProviderStatus } from '../../../types.ts';
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

interface AgolConfig {
    'search::agol::enabled': boolean;
    'search::agol::auth_method': 'oauth2' | 'legacy';
    'search::agol::token': string;
    'search::agol::client_id': string;
    'search::agol::client_secret': string;
}

const props = defineProps<{
    status?: SearchProviderStatus;
}>();

const isOpen = ref<boolean>(false);
const loading = ref<boolean>(false);
const edit = ref<boolean>(false);
const err = ref<Error | null>(null);

const config = ref<AgolConfig>({
    'search::agol::enabled': false,
    'search::agol::auth_method': 'oauth2',
    'search::agol::token': '',
    'search::agol::client_id': '',
    'search::agol::client_secret': '',
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
            'search::agol::enabled': data['search::agol::enabled'] ?? false,
            'search::agol::auth_method': data['search::agol::auth_method'] ?? 'oauth2',
            'search::agol::token': data['search::agol::token'] ?? '',
            'search::agol::client_id': data['search::agol::client_id'] ?? '',
            'search::agol::client_secret': data['search::agol::client_secret'] ?? '',
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
        console.error('Failed to save AGOL config:', error);
    }
    loading.value = false;
}
</script>
