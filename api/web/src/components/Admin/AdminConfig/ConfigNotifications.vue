<template>
    <SlideDownHeader
        v-model='isOpen'
        label='Notifications'
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
                            v-model='config["notification::enabled"]'
                            :disabled='!edit'
                            label='Enable Notifications'
                        />
                    </div>

                    <template v-if='config["notification::enabled"]'>
                        <div class='col-lg-12 mt-2'>
                            <label class='subheader user-select-none'>SMS</label>
                        </div>
                        <div class='col-lg-12'>
                            <TablerToggle
                                v-model='config["notification::sms::enabled"]'
                                :disabled='!edit'
                                label='Enable SMS Notifications'
                            />
                        </div>
                        <div
                            v-if='config["notification::sms::enabled"]'
                            class='col-lg-12'
                        >
                            <TablerEnum
                                v-model='config["notification::sms::service"]'
                                :disabled='!edit'
                                label='SMS Service'
                                :options='["aws"]'
                            />
                        </div>

                        <div class='col-lg-12 mt-2'>
                            <label class='subheader user-select-none'>Email</label>
                        </div>
                        <div class='col-lg-12'>
                            <TablerToggle
                                v-model='config["notification::email::enabled"]'
                                :disabled='!edit'
                                label='Enable Email Notifications'
                            />
                        </div>
                        <div
                            v-if='config["notification::email::enabled"]'
                            class='col-lg-12'
                        >
                            <TablerEnum
                                v-model='config["notification::email::service"]'
                                :disabled='!edit'
                                label='Email Service'
                                :options='["aws"]'
                            />
                        </div>

                        <div class='col-lg-12 mt-2'>
                            <label class='subheader user-select-none'>Push Notifications</label>
                        </div>
                        <div class='col-lg-12'>
                            <TablerToggle
                                v-model='config["notification::push::enabled"]'
                                :disabled='!edit'
                                label='Enable Push Notifications'
                            />
                        </div>
                        <div
                            v-if='config["notification::push::enabled"]'
                            class='col-lg-12'
                        >
                            <TablerEnum
                                v-model='config["notification::push::service"]'
                                :disabled='!edit'
                                label='Push Service'
                                :options='["firebase"]'
                            />
                        </div>
                        <template v-if='config["notification::push::enabled"] && config["notification::push::service"] === "firebase"'>
                            <div class='col-lg-6 mt-2'>
                                <TablerInput
                                    v-model='config["notification::push::firebase::project_id"]'
                                    :disabled='!edit'
                                    label='Firebase Project ID'
                                />
                            </div>
                            <div class='col-lg-6 mt-2'>
                                <TablerInput
                                    v-model='config["notification::push::firebase::client_email"]'
                                    :disabled='!edit'
                                    label='Firebase Client Email'
                                />
                            </div>
                            <div class='col-lg-12'>
                                <TablerInput
                                    v-model='config["notification::push::firebase::private_key"]'
                                    :disabled='!edit'
                                    type='password'
                                    autocomplete='new-password'
                                    label='Firebase Private Key'
                                />
                            </div>
                        </template>
                    </template>
                </div>
            </template>
        </div>
    </SlideDownHeader>
</template>

<script setup lang="ts">
import SlideDownHeader from '../../CloudTAK/util/SlideDownHeader.vue';
import { onMounted, ref, watch } from 'vue';
import { server } from '../../../std.ts';
import {
    TablerLoading,
    TablerToggle,
    TablerEnum,
    TablerInput,
    TablerIconButton,
    TablerAlert,
} from '@tak-ps/vue-tabler';
import {
    IconPencil,
    IconDeviceFloppy,
    IconX,
} from '@tabler/icons-vue';

interface NotificationConfig {
    'notification::enabled': boolean;
    'notification::sms::enabled': boolean;
    'notification::sms::service': 'aws';
    'notification::email::enabled': boolean;
    'notification::email::service': 'aws';
    'notification::push::enabled': boolean;
    'notification::push::service': 'firebase';
    'notification::push::firebase::project_id': string;
    'notification::push::firebase::client_email': string;
    'notification::push::firebase::private_key': string;
}

const isOpen = ref<boolean>(false);
const loading = ref<boolean>(false);
const edit = ref<boolean>(false);
const err = ref<Error | null>(null);

const config = ref<NotificationConfig>({
    'notification::enabled': false,
    'notification::sms::enabled': false,
    'notification::sms::service': 'aws',
    'notification::email::enabled': false,
    'notification::email::service': 'aws',
    'notification::push::enabled': false,
    'notification::push::service': 'firebase',
    'notification::push::firebase::project_id': '',
    'notification::push::firebase::client_email': '',
    'notification::push::firebase::private_key': '',
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
            'notification::enabled': data['notification::enabled'] ?? false,
            'notification::sms::enabled': data['notification::sms::enabled'] ?? false,
            'notification::sms::service': data['notification::sms::service'] ?? 'aws',
            'notification::email::enabled': data['notification::email::enabled'] ?? false,
            'notification::email::service': data['notification::email::service'] ?? 'aws',
            'notification::push::enabled': data['notification::push::enabled'] ?? false,
            'notification::push::service': data['notification::push::service'] ?? 'firebase',
            'notification::push::firebase::project_id': data['notification::push::firebase::project_id'] ?? '',
            'notification::push::firebase::client_email': data['notification::push::firebase::client_email'] ?? '',
            'notification::push::firebase::private_key': data['notification::push::firebase::private_key'] ?? '',
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
            body: config.value,
        });
        if (error) throw new Error(error.message);
        edit.value = false;
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
    }

    loading.value = false;
}
</script>
