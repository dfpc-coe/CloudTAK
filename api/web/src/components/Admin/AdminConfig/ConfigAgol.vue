<template>
    <SlideDownHeader
        v-model='isOpen'
        label='ArcGIS Online'
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
                            v-model='config["agol::enabled"]'
                            :disabled='!edit'
                            label='ArcGIS Online Enabled'
                        />

                        <template v-if='config["agol::enabled"]'>
                            <TablerPillGroup
                                v-model='config["agol::auth_method"]'
                                :options='[
                                    { value: "oauth2", label: "OAuth2" },
                                    { value: "legacy", label: "Legacy" }
                                ]'
                                :disabled='!config["agol::enabled"] || !edit'
                                size='default'
                            />

                            <template v-if='config["agol::auth_method"] === "oauth2"'>
                                <TablerInput
                                    v-model='config["agol::client_id"]'
                                    :disabled='!edit'
                                    label='OAuth2 Client ID'
                                    description='Client ID from your ArcGIS Location Platform or ArcGIS Enterprise account'
                                />
                                <TablerInput
                                    v-model='config["agol::client_secret"]'
                                    type='password'
                                    autocomplete='new-password'
                                    :disabled='!edit'
                                    label='OAuth2 Client Secret'
                                    description='Client Secret from your ArcGIS Location Platform or ArcGIS Enterprise account'
                                />
                            </template>
                            <template v-else>
                                <TablerInput
                                    v-model='config["agol::token"]'
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
import { ref, watch, onMounted } from 'vue';
import { std, stdurl } from '../../../std.ts';
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
    IconX
} from '@tabler/icons-vue';

interface AgolConfig {
    'agol::enabled': boolean;
    'agol::auth_method': 'oauth2' | 'legacy';
    'agol::token': string;
    'agol::client_id': string;
    'agol::client_secret': string;
}

const isOpen = ref<boolean>(false);
const loading = ref<boolean>(false);
const edit = ref<boolean>(false);
const err = ref<Error | null>(null);

const config = ref<AgolConfig>({
    'agol::enabled': false,
    'agol::auth_method': 'oauth2',
    'agol::token': '',
    'agol::client_id': '',
    'agol::client_secret': '',
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
        const url = stdurl('/api/config');
        url.searchParams.set('keys', Object.keys(config.value).join(','));
        const res = await std(url) as Partial<AgolConfig>;

        config.value = {
            'agol::enabled': res['agol::enabled'] ?? false,
            'agol::auth_method': res['agol::auth_method'] ?? 'oauth2',
            'agol::token': res['agol::token'] ?? '',
            'agol::client_id': res['agol::client_id'] ?? '',
            'agol::client_secret': res['agol::client_secret'] ?? '',
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
        await std(`/api/config`, {
            method: 'PUT',
            body: config.value
        });
        edit.value = false;
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
        console.error('Failed to save AGOL config:', error);
    }
    loading.value = false;
}
</script>
