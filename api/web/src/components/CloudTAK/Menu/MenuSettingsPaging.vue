<template>
    <MenuTemplate
        name='Paging Notifications'
        :loading='loading'
    >
        <template #buttons>
            <TablerRefreshButton
                :loading='loading'
                @click='fetch'
            />
        </template>
        <template #default>
            <div class='col-12 d-flex flex-column gap-4 py-3'>
                <!-- SMS -->
                <section>
                    <div class='d-flex align-items-center px-2 mb-2'>
                        <IconMessage
                            :size='20'
                            stroke='1.5'
                            class='text-secondary me-2'
                        />
                        <span class='subheader user-select-none mb-0'>SMS</span>
                        <div class='ms-auto'>
                            <span
                                v-if='smsDisabled'
                                class='badge bg-yellow-lt text-yellow'
                            >Disabled</span>
                            <TablerIconButton
                                v-else
                                title='Add SMS Notification'
                                @click='openCreate("sms")'
                            >
                                <IconPlus
                                    :size='20'
                                    stroke='1.5'
                                />
                            </TablerIconButton>
                        </div>
                    </div>
                    <div class='d-flex flex-column gap-2'>
                        <StandardItem
                            v-for='p in smsItems'
                            :key='p.id'
                            @click='source = p'
                        >
                            <div class='d-flex align-items-center px-3 py-2 gap-3'>
                                <div
                                    class='paging-icon flex-shrink-0'
                                    style='background: rgba(32, 107, 196, 0.15);'
                                >
                                    <IconMessage
                                        :size='22'
                                        stroke='1.5'
                                        class='text-blue'
                                    />
                                </div>
                                <div class='flex-grow-1 text-truncate'>
                                    <div class='fw-bold text-truncate'>
                                        {{ p.value }}
                                    </div>
                                </div>
                                <div class='d-flex align-items-center gap-1 flex-shrink-0'>
                                    <span
                                        v-if='p.verified'
                                        class='badge bg-green-lt d-inline-flex align-items-center gap-1'
                                    >
                                        <IconCircleCheck
                                            :size='14'
                                            stroke='2'
                                        />
                                        Verified
                                    </span>
                                    <span
                                        v-else
                                        class='badge bg-yellow-lt d-inline-flex align-items-center gap-1'
                                    >
                                        <IconAlertCircle
                                            :size='14'
                                            stroke='2'
                                        />
                                        Pending
                                    </span>
                                    <span
                                        v-if='p.enabled'
                                        class='badge bg-blue-lt'
                                    >Enabled</span>
                                </div>
                            </div>
                        </StandardItem>
                        <PagingEmptyHint
                            v-if='!smsItems.length'
                            label='No SMS numbers configured'
                        />
                    </div>
                </section>

                <!-- Email -->
                <section>
                    <div class='d-flex align-items-center px-2 mb-2'>
                        <IconMail
                            :size='20'
                            stroke='1.5'
                            class='text-secondary me-2'
                        />
                        <span class='subheader user-select-none mb-0'>Email</span>
                        <div class='ms-auto'>
                            <span
                                v-if='emailDisabled'
                                class='badge bg-yellow-lt text-yellow'
                            >Disabled</span>
                            <TablerIconButton
                                v-else
                                title='Add Email Notification'
                                @click='openCreate("email")'
                            >
                                <IconPlus
                                    :size='20'
                                    stroke='1.5'
                                />
                            </TablerIconButton>
                        </div>
                    </div>
                    <div class='d-flex flex-column gap-2'>
                        <StandardItem
                            v-for='p in emailItems'
                            :key='p.id'
                            @click='source = p'
                        >
                            <div class='d-flex align-items-center px-3 py-2 gap-3'>
                                <div
                                    class='paging-icon flex-shrink-0'
                                    style='background: rgba(63, 182, 139, 0.15);'
                                >
                                    <IconMail
                                        :size='22'
                                        stroke='1.5'
                                        class='text-green'
                                    />
                                </div>
                                <div class='flex-grow-1 text-truncate'>
                                    <div class='fw-bold text-truncate'>
                                        {{ p.value }}
                                    </div>
                                </div>
                                <div class='d-flex align-items-center gap-1 flex-shrink-0'>
                                    <span
                                        v-if='p.verified'
                                        class='badge bg-green-lt d-inline-flex align-items-center gap-1'
                                    >
                                        <IconCircleCheck
                                            :size='14'
                                            stroke='2'
                                        />
                                        Verified
                                    </span>
                                    <span
                                        v-else
                                        class='badge bg-yellow-lt d-inline-flex align-items-center gap-1'
                                    >
                                        <IconAlertCircle
                                            :size='14'
                                            stroke='2'
                                        />
                                        Pending
                                    </span>
                                    <span
                                        v-if='p.enabled'
                                        class='badge bg-blue-lt'
                                    >Enabled</span>
                                </div>
                            </div>
                        </StandardItem>
                        <PagingEmptyHint
                            v-if='!emailItems.length'
                            label='No email addresses configured'
                        />
                    </div>
                </section>

                <!-- Push Notifications -->
                <section>
                    <div class='d-flex align-items-center px-2 mb-2'>
                        <IconDeviceMobile
                            :size='20'
                            stroke='1.5'
                            class='text-secondary me-2'
                        />
                        <span class='subheader user-select-none mb-0'>Push Notifications</span>
                        <div class='ms-auto'>
                            <span
                                v-if='pushDisabled'
                                class='badge bg-yellow-lt text-yellow'
                            >Disabled</span>
                            <template v-else>
                                <TablerIconButton
                                    v-if='!pushLoading'
                                    title='Register This Device'
                                    @click='registerPush'
                                >
                                    <IconPlus
                                        :size='20'
                                        stroke='1.5'
                                    />
                                </TablerIconButton>
                                <div
                                    v-else
                                    class='spinner-border spinner-border-sm text-secondary'
                                    role='status'
                                />
                            </template>
                        </div>
                    </div>
                    <TablerAlert
                        v-if='pushErr'
                        class='mb-2'
                        :err='pushErr'
                    />
                    <div class='d-flex flex-column gap-2'>
                        <StandardItem
                            v-for='p in pushItems'
                            :key='p.id'
                            :hover='false'
                        >
                            <div class='d-flex align-items-center px-3 py-2 gap-3'>
                                <div
                                    class='paging-icon flex-shrink-0'
                                    style='background: rgba(174, 62, 201, 0.15);'
                                >
                                    <IconDeviceMobile
                                        :size='22'
                                        stroke='1.5'
                                        class='text-purple'
                                    />
                                </div>
                                <div class='flex-grow-1 text-truncate'>
                                    <div class='fw-bold text-truncate'>
                                        {{ p.value || 'Registered Device' }}
                                    </div>
                                    <div class='text-secondary small'>
                                        Registered {{ new Date(p.created).toLocaleString() }}
                                    </div>
                                </div>
                                <label class='form-check form-switch m-0'>
                                    <input
                                        class='form-check-input'
                                        type='checkbox'
                                        :checked='p.enabled'
                                        @change='togglePush(p)'
                                    >
                                </label>
                                <TablerDelete
                                    displaytype='icon'
                                    @delete='deletePush(p)'
                                />
                            </div>
                        </StandardItem>
                        <PagingEmptyHint
                            v-if='!pushItems.length'
                            label='No devices registered. Tap the + button to register this device.'
                        />
                    </div>
                </section>
            </div>
        </template>
    </MenuTemplate>

    <PagingModal
        v-if='source !== false'
        :source='source'
        @close='source = false'
        @refresh='fetch'
    />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import MenuTemplate from '../util/MenuTemplate.vue';
import StandardItem from '../util/StandardItem.vue';
import PagingEmptyHint from './Settings/PagingEmptyHint.vue';
import { server } from '../../../std.ts';
import { useDeviceStore } from '../../../stores/device.ts';
import { syncPushToken, forgetPushToken } from '../../../base/push.ts';
import type { ProfilePaging, ProfilePagingList, ProfilePaging_Create } from '../../../types.ts';
import PagingModal from './Settings/PagingModal.vue';
import {
    TablerIconButton,
    TablerRefreshButton,
    TablerDelete,
    TablerAlert,
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconMessage,
    IconMail,
    IconDeviceMobile,
    IconCircleCheck,
    IconAlertCircle,
} from '@tabler/icons-vue';

const loading = ref<boolean>(true);
const source = ref<ProfilePaging | { type: ProfilePaging_Create['type'] } | false>(false);
const pushLoading = ref<boolean>(false);
const pushErr = ref<Error | null>(null);
const deviceStore = useDeviceStore();
const paging = ref<ProfilePagingList>({
    total: 0,
    items: []
});

const notificationConfig = ref({
    'notification::enabled': true,
    'notification::sms::enabled': true,
    'notification::email::enabled': true,
    'notification::push::enabled': true,
});

const smsDisabled = computed(() => !notificationConfig.value['notification::enabled'] || !notificationConfig.value['notification::sms::enabled']);
const emailDisabled = computed(() => !notificationConfig.value['notification::enabled'] || !notificationConfig.value['notification::email::enabled']);
const pushDisabled = computed(() => !notificationConfig.value['notification::enabled'] || !notificationConfig.value['notification::push::enabled']);

const smsItems = computed(() => paging.value.items.filter((p) => p.type === 'sms'));
const emailItems = computed(() => paging.value.items.filter((p) => p.type === 'email'));
const pushItems = computed(() => paging.value.items.filter((p) => p.type === 'push'));

onMounted(async () => {
    await fetchConfig();
    await fetch();
});

async function fetchConfig(): Promise<void> {
    const { data, error } = await server.GET('/api/config', {
        params: { query: { keys: Object.keys(notificationConfig.value).join(',') } }
    });
    if (error) throw new Error(error.message);

    notificationConfig.value = {
        'notification::enabled': data['notification::enabled'] ?? true,
        'notification::sms::enabled': data['notification::sms::enabled'] ?? true,
        'notification::email::enabled': data['notification::email::enabled'] ?? true,
        'notification::push::enabled': data['notification::push::enabled'] ?? true,
    };
}

function openCreate(type: ProfilePaging_Create['type']): void {
    source.value = { type };
}

async function fetch(): Promise<void> {
    source.value = false;
    loading.value = true;
    const { data, error } = await server.GET('/api/profile/paging', {
        params: { query: { limit: 100, page: 0, order: 'desc', sort: 'created' } }
    });
    if (error) throw new Error(error.message);
    paging.value = data;
    loading.value = false;
}

async function togglePush(device: ProfilePaging): Promise<void> {
    const res = await server.PATCH('/api/profile/paging/{:pagingid}', {
        params: { path: { ':pagingid': device.id } },
        body: { enabled: !device.enabled }
    });
    if (res.error) throw new Error(res.error.message);
    await fetch();
}

async function deletePush(device: ProfilePaging): Promise<void> {
    const res = await server.DELETE('/api/profile/paging/{:pagingid}', {
        params: { path: { ':pagingid': device.id } }
    });
    if (res.error) throw new Error(res.error.message);
    // If this was the current device's registration, forget it locally so it
    // is not automatically re-created on the next launch.
    await forgetPushToken(device.value);
    await fetch();
}

async function registerPush(): Promise<void> {
    pushLoading.value = true;
    pushErr.value = null;
    try {
        await deviceStore.notification.request();
        if (deviceStore.permissions.notification !== 'granted') {
            pushErr.value = new Error('Push notification permission was not granted.');
            return;
        }
        const token = deviceStore.getMessagingToken() ?? await deviceStore.refreshMessagingToken();
        if (!token) {
            pushErr.value = new Error('Failed to obtain a push notification token.');
            return;
        }

        await syncPushToken(token);

        await fetch();
    } catch (err) {
        pushErr.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        pushLoading.value = false;
    }
}
</script>

<style scoped>
.paging-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
}
</style>
