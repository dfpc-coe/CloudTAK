<template>
    <SlideDownHeader
        v-model='isOpen'
        label='Firebase Notifications'
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
                <div class='small text-muted mb-3'>
                    Store the Firebase web app settings used to initialize push notifications for CloudTAK clients.
                </div>
                <div class='row'>
                    <div class='col-lg-6'>
                        <TablerInput
                            v-model='config[`firebase::apikey`]'
                            label='Firebase API Key'
                            :disabled='!edit'
                        />
                    </div>
                    <div class='col-lg-6'>
                        <TablerInput
                            v-model='config[`firebase::authdomain`]'
                            label='Firebase Auth Domain'
                            :disabled='!edit'
                        />
                    </div>
                    <div class='col-lg-6'>
                        <TablerInput
                            v-model='config[`firebase::projectid`]'
                            label='Firebase Project ID'
                            :disabled='!edit'
                        />
                    </div>
                    <div class='col-lg-6'>
                        <TablerInput
                            v-model='config[`firebase::storagebucket`]'
                            label='Firebase Storage Bucket'
                            :disabled='!edit'
                        />
                    </div>
                    <div class='col-lg-6'>
                        <TablerInput
                            v-model='config[`firebase::messagingsenderid`]'
                            label='Firebase Messaging Sender ID'
                            :disabled='!edit'
                        />
                    </div>
                    <div class='col-lg-6'>
                        <TablerInput
                            v-model='config[`firebase::appid`]'
                            label='Firebase App ID'
                            :disabled='!edit'
                        />
                    </div>
                    <div class='col-lg-12'>
                        <TablerInput
                            v-model='config[`firebase::measurementid`]'
                            label='Firebase Measurement ID'
                            :disabled='!edit'
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
import {
    TablerLoading,
    TablerInput,
    TablerIconButton,
    TablerAlert
} from '@tak-ps/vue-tabler';
import {
    IconPencil,
    IconDeviceFloppy,
    IconX
} from '@tabler/icons-vue';

interface FirebaseConfig {
    'firebase::apikey': string;
    'firebase::authdomain': string;
    'firebase::projectid': string;
    'firebase::storagebucket': string;
    'firebase::messagingsenderid': string;
    'firebase::appid': string;
    'firebase::measurementid': string;
}

const isOpen = ref<boolean>(false);
const loading = ref<boolean>(false);
const edit = ref<boolean>(false);
const err = ref<Error | null>(null);

const config = ref<FirebaseConfig>({
    'firebase::apikey': '',
    'firebase::authdomain': '',
    'firebase::projectid': '',
    'firebase::storagebucket': '',
    'firebase::messagingsenderid': '',
    'firebase::appid': '',
    'firebase::measurementid': '',
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
            'firebase::apikey': data['firebase::apikey'] ?? '',
            'firebase::authdomain': data['firebase::authdomain'] ?? '',
            'firebase::projectid': data['firebase::projectid'] ?? '',
            'firebase::storagebucket': data['firebase::storagebucket'] ?? '',
            'firebase::messagingsenderid': data['firebase::messagingsenderid'] ?? '',
            'firebase::appid': data['firebase::appid'] ?? '',
            'firebase::measurementid': data['firebase::measurementid'] ?? '',
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
        console.error('Failed to save Firebase config:', error);
    }
    loading.value = false;
}
</script>