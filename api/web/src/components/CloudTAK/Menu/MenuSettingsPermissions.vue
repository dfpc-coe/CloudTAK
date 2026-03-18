<template>
    <MenuTemplate
        name='Permissions'
        :loading='loading'
    >
        <template #buttons>
            <TablerIconButton
                title='Refresh Permissions'
                :disabled='Boolean(working)'
                @click='refreshStatuses'
            >
                <IconRefresh
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
        </template>

        <div class='col-12 d-flex flex-column gap-2 p-3'>
            <div
                v-if='error'
                class='alert alert-warning mb-0'
                role='alert'
            >
                {{ error }}
            </div>

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
                                <div class='fw-bold'>{{ item.title }}</div>

                                <div class='text-secondary small mt-1'>
                                    {{ item.description }}
                                </div>
                            </div>
                        </div>

                        <TablerBadge
                            class='text-uppercase flex-shrink-0'
                            v-bind='badgeProps(item.status)'
                        >
                            {{ statusLabel(item.status) }}
                        </TablerBadge>
                    </div>

                    <div
                        v-if='item.status !== "granted" && item.status !== "unsupported"'
                        class='d-flex justify-content-end'
                    >
                        <button
                            class='btn btn-primary'
                            :disabled='!canRequest(item.key, item.status) || working === item.key'
                            @click='requestPermission(item.key)'
                        >
                            {{ actionLabel(item.status, item.key) }}
                        </button>
                    </div>
                </div>
            </StandardItem>
        </div>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { computed, onMounted, ref } from 'vue';
import {
    IconBell,
    IconCamera,
    IconCompass,
    IconDatabase,
    IconFolderOpen,
    IconMapPin,
    IconRefresh,
    IconSun,
} from '@tabler/icons-vue';
import { TablerBadge, TablerIconButton } from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';
import StandardItem from '../util/StandardItem.vue';
import { useMapStore } from '../../../stores/map.ts';
import type { BrowserPermissionState } from '../../../stores/map.ts';

const mapStore = useMapStore();
type PermissionKey = 'location' | 'notification' | 'orientation' | 'storage' | 'camera' | 'wakeLock' | 'fileSystem';

const loading = ref(true);
const error = ref('');
const working = ref<PermissionKey | undefined>();

const permissionItems = computed(() => {
    return [{
        key: 'notification' as const,
        title: 'Notifications',
        icon: IconBell,
        status: mapStore.permissions.notification,
        description: descriptionFor('notification', mapStore.permissions.notification)
    }, {
        key: 'camera' as const,
        title: 'Camera',
        icon: IconCamera,
        status: mapStore.permissions.camera,
        description: descriptionFor('camera', mapStore.permissions.camera)
    }, {
        key: 'location' as const,
        title: 'Location',
        icon: IconMapPin,
        status: mapStore.permissions.location,
        description: descriptionFor('location', mapStore.permissions.location)
    }, {
        key: 'orientation' as const,
        title: 'Device Orientation',
        icon: IconCompass,
        status: mapStore.permissions.orientation,
        description: descriptionFor('orientation', mapStore.permissions.orientation)
    }, {
        key: 'storage' as const,
        title: 'Persistent Storage',
        icon: IconDatabase,
        status: mapStore.permissions.storage,
        description: descriptionFor('storage', mapStore.permissions.storage)
    }, {
        key: 'fileSystem' as const,
        title: 'File System Access',
        icon: IconFolderOpen,
        status: mapStore.permissions.fileSystem,
        description: descriptionFor('fileSystem', mapStore.permissions.fileSystem)
    }, {
        key: 'wakeLock' as const,
        title: 'Wake Lock',
        icon: IconSun,
        status: mapStore.permissions.wakeLock,
        description: descriptionFor('wakeLock', mapStore.permissions.wakeLock)
    }];
});

onMounted(async () => {
    await refreshStatuses();
    loading.value = false;
});

function statusLabel(status: BrowserPermissionState): string {
    switch (status) {
        case 'granted': return 'Allowed';
        case 'denied': return 'Disallowed';
        case 'prompt': return 'Ask';
        case 'unsupported': return 'Unsupported';
        default: return 'Unknown';
    }
}

function badgeProps(status: BrowserPermissionState): Record<string, string> {
    if (status === 'unsupported') {
        return {
            backgroundColor: 'rgba(249, 115, 22, 0.18)',
            borderColor: 'rgba(234, 88, 12, 0.35)',
            textColor: '#fdba74'
        };
    }

    return {};
}

function descriptionFor(type: PermissionKey, status: BrowserPermissionState): string {
    if (status === 'granted') {
        return type === 'location'
            ? 'CloudTAK can access your live position.'
            : type === 'notification'
                ? 'CloudTAK can deliver browser notifications.'
                : type === 'orientation'
                    ? 'CloudTAK can access your device orientation for compass-based map rotation.'
                    : type === 'storage'
                        ? 'CloudTAK can persist local data storage for more reliable offline access.'
                        : type === 'camera'
                            ? 'CloudTAK can access your camera when needed.'
                            : type === 'fileSystem'
                                    ? 'CloudTAK can open local files for import and export workflows.'
                                    : 'CloudTAK can keep the screen awake during active operations.';
    }

    if (status === 'denied') {
        return type === 'location'
            ? 'Location access is currently blocked. Use the button below to try again.'
            : type === 'notification'
                ? 'Notification access is currently blocked. Use the button below to try again.'
                : type === 'orientation'
                    ? 'Device orientation access is currently blocked. Use the button below to try again.'
                    : type === 'storage'
                        ? 'Persistent storage was not granted. Use the button below to try again.'
                        : type === 'camera'
                            ? 'Camera access is currently blocked. Use the button below to try again.'
                            : type === 'fileSystem'
                                    ? 'File system access is currently blocked. Use the button below to try again.'
                                    : 'Wake lock access is currently blocked. Use the button below to try again.';
    }

    if (status === 'prompt') {
        return type === 'location'
            ? 'Location access has not been granted yet.'
            : type === 'notification'
                ? 'Notification access has not been granted yet.'
                : type === 'orientation'
                    ? 'Device orientation access has not been granted yet.'
                    : type === 'storage'
                        ? 'Persistent storage has not been requested yet.'
                        : type === 'camera'
                            ? 'Camera access has not been granted yet.'
                            : type === 'fileSystem'
                                    ? 'File system access has not been granted yet.'
                                    : 'Wake lock access has not been granted yet.';
    }

    if (status === 'unsupported') {
        return type === 'location'
            ? 'This browser does not support geolocation permissions.'
            : type === 'notification'
                ? 'This browser does not support notification permissions.'
                : type === 'orientation'
                    ? 'This browser does not support device orientation events.'
                    : type === 'storage'
                        ? 'This browser does not support persistent storage requests.'
                        : type === 'camera'
                            ? 'This browser does not support camera access requests.'
                            : type === 'fileSystem'
                                    ? 'This browser does not support file system access requests.'
                                    : 'This browser does not support wake lock requests.';
    }

    return type === 'location'
        ? 'CloudTAK could not determine the current location permission state.'
        : type === 'notification'
            ? 'CloudTAK could not determine the current notification permission state.'
            : type === 'orientation'
                ? 'CloudTAK could not determine the current device orientation permission state.'
                : type === 'storage'
                    ? 'CloudTAK could not determine the current persistent storage state.'
                    : type === 'camera'
                        ? 'CloudTAK could not determine the current camera permission state.'
                        : type === 'fileSystem'
                                ? 'CloudTAK could not determine the current file system access state.'
                                : 'CloudTAK could not determine the current wake lock state.';
}

function canRequest(type: PermissionKey, status: BrowserPermissionState): boolean {
    if (type === 'orientation' && !mapStore.hasOrientationPermissionRequest() && status !== 'granted') {
        return false;
    }

    return status !== 'granted' && status !== 'unsupported';
}

function actionLabel(status: BrowserPermissionState, type: PermissionKey): string {
    if (working.value === type) return 'Requesting...';
    if (type === 'orientation' && !mapStore.hasOrientationPermissionRequest() && status !== 'granted') return 'Unavailable';
    if (status === 'denied') return 'Re-request Permission';
    if (status === 'granted') return 'Allowed';
    return 'Request Permission';
}

async function refreshStatuses(): Promise<void> {
    error.value = '';

    try {
        await mapStore.refreshPermissionStatuses();
    } catch (err) {
        error.value = err instanceof Error ? err.message : 'Failed to refresh permission status';
    }
}

async function requestPermission(type: PermissionKey): Promise<void> {
    error.value = '';
    working.value = type;

    try {
        if (type === 'location') {
            await mapStore.requestLocationPermission();
        } else if (type === 'camera') {
            await mapStore.requestCameraPermission();
        } else if (type === 'orientation') {
            await mapStore.requestOrientationPermission();
        } else if (type === 'fileSystem') {
            await mapStore.requestFileSystemPermission();
        } else if (type === 'storage') {
            await mapStore.requestStoragePermission();
        } else if (type === 'wakeLock') {
            await mapStore.requestWakeLockPermission();
        } else {
            await mapStore.requestNotificationPermission();
        }
    } catch (err) {
        error.value = err instanceof Error ? err.message : `Failed to request ${type} permission`;
    } finally {
        working.value = undefined;
        await refreshStatuses();
    }
}
</script>
