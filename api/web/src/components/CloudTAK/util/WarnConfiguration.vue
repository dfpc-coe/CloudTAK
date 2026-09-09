<template>
    <TablerModal size='lg'>
        <div class='modal-status bg-red' />
        <div class='modal-header'>
            <div class='d-flex align-items-center'>
                <IconInfoSquare
                    :size='28'
                    stroke='1'
                />
                <span class='mx-2'>{{ current === 'details' ? 'Welcome to CloudTAK' : 'Permissions' }}</span>
            </div>
        </div>
        <div class='modal-body'>
            <template v-if='current === "details"'>
                <TablerLoading v-if='loading' />
                <template v-else>
                    <p class='text-secondary'>
                        Before you get started, tell other TAK users who you are. These can be changed at any time from Settings.
                    </p>

                    <div class='row g-3'>
                        <div class='col-12'>
                            <TablerInput
                                v-model='form.tak_callsign'
                                label='Callsign'
                                description='The name other users will see you as on the map'
                                placeholder='Enter your callsign'
                                :autofocus='true'
                                :required='true'
                                :error='callsignError'
                                @keyup.enter='submitDetails'
                            />
                        </div>
                        <div class='col-12 col-md-6'>
                            <TablerEnum
                                v-model='form.tak_group'
                                label='Team'
                                :options='groupOptions'
                            />
                        </div>
                        <div class='col-12 col-md-6'>
                            <TablerEnum
                                v-model='form.tak_role'
                                label='Role'
                                :options='roles'
                            />
                        </div>
                        <div class='col-12'>
                            <TablerInput
                                v-model='form.tak_phone'
                                label='Phone Number'
                                description='Optional - shared with other users in your channels'
                                type='tel'
                            />
                        </div>
                    </div>
                </template>
            </template>
            <template v-else>
                <p class='text-secondary'>
                    CloudTAK needs the following permissions to share your position with your team and keep you informed. You can review these later under Settings.
                </p>

                <div
                    v-if='error'
                    class='alert alert-warning'
                    role='alert'
                >
                    {{ error }}
                </div>

                <div class='d-flex flex-column gap-2'>
                    <StandardItem
                        v-for='item of permissionItems'
                        :key='item.key'
                        :hover='false'
                    >
                        <div class='d-flex flex-column gap-3 px-3 py-3'>
                            <div class='d-flex align-items-start justify-content-between gap-3'>
                                <div class='d-flex align-items-start gap-3 flex-grow-1'>
                                    <component
                                        :is='item.icon'
                                        :size='30'
                                        stroke='1.5'
                                        class='flex-shrink-0 mt-1'
                                    />

                                    <div class='flex-grow-1'>
                                        <div class='fw-bold'>
                                            {{ item.title }}
                                        </div>

                                        <div class='text-secondary small mt-1'>
                                            {{ item.description }}
                                        </div>
                                    </div>
                                </div>

                                <TablerBadge
                                    class='text-uppercase flex-shrink-0'
                                    v-bind='badgeProps(item.status)'
                                >
                                    {{ badgeLabel(item.status) }}
                                </TablerBadge>
                            </div>

                            <div
                                v-if='!item.satisfied'
                                class='d-flex justify-content-end'
                            >
                                <button
                                    class='btn btn-primary'
                                    :disabled='working === item.key'
                                    @click='requestPermission(item.key)'
                                >
                                    {{ actionLabel(item.key, item.status) }}
                                </button>
                            </div>
                        </div>
                    </StandardItem>
                </div>
            </template>
        </div>
        <div class='modal-footer'>
            <template v-if='current === "details"'>
                <div class='ms-auto'>
                    <button
                        class='btn btn-primary'
                        :disabled='loading || saving || !!callsignError'
                        @click='submitDetails'
                    >
                        <TablerLoading
                            v-if='saving'
                            :inline='true'
                        />
                        <span v-else>Get Started</span>
                    </button>
                </div>
            </template>
            <template v-else>
                <button
                    class='btn btn-link text-secondary'
                    @click='emit("close")'
                >
                    Skip for now
                </button>
                <div class='ms-auto btn-list'>
                    <button
                        class='btn btn-secondary'
                        :disabled='Boolean(working)'
                        @click='refreshStatuses'
                    >
                        Refresh
                    </button>
                    <button
                        class='btn btn-primary'
                        :disabled='!deviceStore.hasRequiredPermissions()'
                        @click='emit("close")'
                    >
                        Done
                    </button>
                </div>
            </template>
        </div>
    </TablerModal>
</template>

<script lang='ts'>
export type WarnConfigurationPage = 'details' | 'permissions';
</script>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import type { Component, PropType } from 'vue';
import {
    TablerModal,
    TablerInput,
    TablerEnum,
    TablerBadge,
    TablerLoading,
} from '@tak-ps/vue-tabler';
import {
    IconBell,
    IconInfoSquare,
    IconMapPin,
} from '@tabler/icons-vue';
import StandardItem from './StandardItem.vue';
import type { Profile } from '../../../types.ts';
import Config from '../../../base/config.ts';
import type { FullConfig } from '../../../base/config.ts';
import ProfileConfig from '../../../base/profile.ts';
import { validateTextNotEmpty } from '../../../utils/validators.ts';
import { isNativePlatform } from '../../../utils/capacitor.ts';
import { useMapStore } from '../../../stores/map.ts';
import { useDeviceStore } from '../../../stores/device.ts';
import type { BrowserPermissionState, BrowserPermissionType } from '../../../stores/device.ts';

const mapStore = useMapStore();
const deviceStore = useDeviceStore();

const props = defineProps({
    page: {
        type: String as PropType<WarnConfigurationPage>,
        default: 'details'
    }
});

const emit = defineEmits([ 'close' ]);

const current = ref<WarnConfigurationPage>(props.page);

// --- User Details ---

const roles: Profile['tak_role'][] = ['Team Member', 'Team Lead', 'HQ', 'Sniper', 'Medic', 'Forward Observer', 'RTO', 'K9'];

const groupKeys: (keyof FullConfig)[] = [
    'group::Yellow',
    'group::Cyan',
    'group::Green',
    'group::Red',
    'group::Purple',
    'group::Orange',
    'group::Blue',
    'group::Magenta',
    'group::White',
    'group::Maroon',
    'group::Dark Blue',
    'group::Teal',
    'group::Dark Green',
    'group::Brown',
];

const loading = ref(true);
const saving = ref(false);
const groups = ref<Record<string, string>>({});

const form = ref({
    tak_callsign: '',
    tak_group: '',
    tak_role: '' as Profile['tak_role'],
    tak_phone: '',
});

const groupOptions = computed(() => {
    return Object.entries(groups.value).map(([name, description]) => {
        return description ? `${name} - ${description}` : name;
    });
});

const callsignError = computed(() => validateTextNotEmpty(form.value.tak_callsign));

onMounted(async () => {
    if (current.value !== 'details') return;

    const config = await Config.list(groupKeys);
    const result: Record<string, string> = {};
    for (const key of groupKeys) {
        const val = config[key];
        result[key.replace('group::', '')] = val ? String(val) : '';
    }
    groups.value = result;

    const group = (await ProfileConfig.get('tak_group'))?.value;
    const role = (await ProfileConfig.get('tak_role'))?.value;
    const phone = (await ProfileConfig.get('tak_phone'))?.value;

    form.value.tak_group = group && groups.value[group]
        ? `${group} - ${groups.value[group]}`
        : (group || groupOptions.value[0] || '');
    form.value.tak_role = role || roles[0];
    form.value.tak_phone = phone || '';

    loading.value = false;
});

async function submitDetails() {
    if (callsignError.value || saving.value) return;

    saving.value = true;
    try {
        const group = form.value.tak_group.replace(/\s-\s.*$/, '');

        await mapStore.worker.profile.update({
            tak_callsign: form.value.tak_callsign.trim(),
            tak_role: form.value.tak_role,
            tak_phone: form.value.tak_phone.trim(),
            ...(group ? { tak_group: group as Profile['tak_group'] } : {}),
        });
    } finally {
        saving.value = false;
    }

    if (deviceStore.hasRequiredPermissions()) {
        emit('close');
    } else {
        current.value = 'permissions';
    }
}

// --- Permissions ---

type PermissionDescriptor = {
    key: BrowserPermissionType;
    title: string;
    description: string;
    icon: Component;
};

const permissionDescriptors: Record<string, PermissionDescriptor> = {
    location: {
        key: 'location',
        title: 'Location',
        description: 'Share your live position with your team on the map.',
        icon: IconMapPin,
    },
    notification: {
        key: 'notification',
        title: 'Notifications',
        description: 'Receive alerts for chats, pages, and mission updates.',
        icon: IconBell,
    },
};

const error = ref('');
const working = ref<BrowserPermissionType | undefined>();

const permissionItems = computed(() => {
    return deviceStore.requiredPermissions
        .map((key) => permissionDescriptors[key])
        .filter((item): item is PermissionDescriptor => !!item)
        .map((item) => ({
            ...item,
            status: deviceStore.permissions[item.key],
            satisfied: deviceStore.isPermissionSatisfied(item.key),
        }));
});

function badgeLabel(status: BrowserPermissionState): string {
    switch (status) {
        case 'granted': return 'Allowed';
        case 'when_in_use': return 'While Using';
        case 'denied': return 'Re-request';
        case 'prompt': return 'Request';
        case 'unsupported': return 'Unsupported';
        default: return 'Request';
    }
}

function badgeProps(status: BrowserPermissionState): Record<string, string> {
    switch (status) {
        case 'unsupported':
        case 'when_in_use':
            return {
                backgroundColor: 'rgba(249, 115, 22, 0.18)',
                borderColor: 'rgba(234, 88, 12, 0.35)',
                textColor: '#fdba74'
            };
        case 'granted':
            return {};
        default:
            return {
                backgroundColor: 'rgba(220, 38, 38, 0.16)',
                borderColor: 'rgba(185, 28, 28, 0.32)',
                textColor: '#fca5a5'
            };
    }
}

// iOS never re-shows a system prompt after a denial, so only then do we
// fall back to the settings app; otherwise the in-app request drives the
// system dialogs (Share Location, then the Always upgrade).
function needsNativeSettings(status: BrowserPermissionState): boolean {
    return isNativePlatform() && status === 'denied';
}

function actionLabel(type: BrowserPermissionType, status: BrowserPermissionState): string {
    if (working.value === type) return 'Requesting...';
    if (needsNativeSettings(status)) return 'Open Settings';
    if (status === 'denied') return 'Re-request Permission';
    return 'Request Permission';
}

async function refreshStatuses(): Promise<void> {
    error.value = '';

    try {
        await deviceStore.refreshPermissionStatuses();
    } catch (err) {
        error.value = err instanceof Error ? err.message : 'Failed to refresh permission status';
    }
}

async function requestPermission(type: BrowserPermissionType): Promise<void> {
    error.value = '';
    working.value = type;

    try {
        if (needsNativeSettings(deviceStore.permissions[type])) {
            await deviceStore.geolocation.openNativeSettings();
        } else if (type === 'location') {
            await deviceStore.geolocation.request(() => {
                void mapStore.startLocationWatch();
            });
        } else if (type === 'notification') {
            await deviceStore.notification.request();
        }
    } catch (err) {
        error.value = err instanceof Error ? err.message : `Failed to request ${type} permission`;
    } finally {
        working.value = undefined;
        await refreshStatuses();
    }
}
</script>
