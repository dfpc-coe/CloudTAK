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

        <div class='col-12 d-flex flex-column gap-2 py-3'>
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
                        v-if='shouldShowAction(item.status)'
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
import type { Component } from 'vue';
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
import { usePermissionStore } from '../../../stores/modules/permissions.ts';
import type { BrowserPermissionState } from '../../../stores/modules/permissions.ts';

const mapStore = useMapStore();
const permissionStore = usePermissionStore();
type PermissionKey = 'location' | 'notification' | 'orientation' | 'storage' | 'camera' | 'wakeLock' | 'fileSystem';
type PermissionDescriptor = {
    key: PermissionKey;
    title: string;
    icon: Component;
};
type PermissionStatusText = Record<PermissionKey, string>;

const loading = ref(true);
const error = ref('');
const working = ref<PermissionKey | undefined>();

const permissionDescriptors: PermissionDescriptor[] = [{
    key: 'notification',
    title: 'Notifications',
    icon: IconBell,
}, {
    key: 'camera',
    title: 'Camera',
    icon: IconCamera,
}, {
    key: 'location',
    title: 'Location',
    icon: IconMapPin,
}, {
    key: 'orientation',
    title: 'Motion & Orientation',
    icon: IconCompass,
}, {
    key: 'storage',
    title: 'Persistent Storage',
    icon: IconDatabase,
}, {
    key: 'fileSystem',
    title: 'File System Access',
    icon: IconFolderOpen,
}, {
    key: 'wakeLock',
    title: 'Wake Lock',
    icon: IconSun,
}];

const permissionDescriptions: Record<'granted' | 'denied' | 'prompt' | 'unsupported' | 'unknown', PermissionStatusText> = {
    granted: {
        location: 'CloudTAK can access your live position.',
        notification: 'CloudTAK can deliver browser notifications.',
        orientation: 'CloudTAK can access motion and orientation sensor data for compass-based map rotation.',
        storage: 'CloudTAK can persist local data storage for more reliable offline access.',
        camera: 'CloudTAK can access your camera when needed.',
        wakeLock: 'CloudTAK can keep the screen awake during active operations.',
        fileSystem: 'CloudTAK can open local files for import and export workflows.'
    },
    denied: {
        location: 'Location access is currently blocked. Use the button below to try again.',
        notification: 'Notification access is currently blocked. Use the button below to try again.',
        orientation: 'Motion and orientation sensor access is currently blocked. Use the button below to try again.',
        storage: 'Persistent storage was not granted. Use the button below to try again.',
        camera: 'Camera access is currently blocked. Use the button below to try again.',
        wakeLock: 'Wake lock access is currently blocked. Use the button below to try again.',
        fileSystem: 'File system access is currently blocked. Use the button below to try again.'
    },
    prompt: {
        location: 'Location access has not been granted yet.',
        notification: 'Notification access has not been granted yet.',
        orientation: 'Motion and orientation sensor access has not been granted yet.',
        storage: 'Persistent storage has not been requested yet.',
        camera: 'Camera access has not been granted yet.',
        wakeLock: 'Wake lock access has not been granted yet.',
        fileSystem: 'File system access has not been granted yet.'
    },
    unsupported: {
        location: 'This browser does not support geolocation permissions.',
        notification: 'This browser does not support notification permissions.',
        orientation: 'This device does not support motion and orientation sensor access.',
        storage: 'This browser does not support persistent storage requests.',
        camera: 'This browser does not support camera access requests.',
        wakeLock: 'This browser does not support wake lock requests.',
        fileSystem: 'This browser does not support file system access requests.'
    },
    unknown: {
        location: 'CloudTAK could not determine the current location permission state.',
        notification: 'CloudTAK could not determine the current notification permission state.',
        orientation: 'CloudTAK could not determine the current motion and orientation permission state.',
        storage: 'CloudTAK could not determine the current persistent storage state.',
        camera: 'CloudTAK could not determine the current camera permission state.',
        wakeLock: 'CloudTAK could not determine the current wake lock state.',
        fileSystem: 'CloudTAK could not determine the current file system access state.'
    }
};

const permissionItems = computed(() => {
    return permissionDescriptors.map((permission) => {
        const status = permissionStore.permissions[permission.key];

        return {
            ...permission,
            status,
            description: descriptionFor(permission.key, status)
        };
    });
});

onMounted(async () => {
    await refreshStatuses();
    loading.value = false;
});

function badgeLabel(status: BrowserPermissionState): string {
    switch (status) {
        case 'granted': return 'Allowed';
        case 'denied': return 'Re-request';
        case 'prompt': return 'Request';
        case 'unsupported': return 'Unsupported';
        default: return 'Request';
    }
}

function badgeProps(status: BrowserPermissionState): Record<string, string> {
    switch (status) {
        case 'unsupported':
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

function descriptionFor(type: PermissionKey, status: BrowserPermissionState): string {
    switch (status) {
        case 'granted':
            return permissionDescriptions.granted[type];
        case 'denied':
            return permissionDescriptions.denied[type];
        case 'prompt':
            return permissionDescriptions.prompt[type];
        case 'unsupported':
            return permissionDescriptions.unsupported[type];
        default:
            return permissionDescriptions.unknown[type];
    }
}

function canRequest(type: PermissionKey, status: BrowserPermissionState): boolean {
    if (type === 'orientation' && !permissionStore.hasOrientationPermissionRequest() && status !== 'granted') {
        return false;
    }

    return status !== 'granted' && status !== 'unsupported';
}

function shouldShowAction(status: BrowserPermissionState): boolean {
    return status !== 'granted' && status !== 'unsupported';
}

function actionLabel(status: BrowserPermissionState, type: PermissionKey): string {
    if (working.value === type) return 'Requesting...';
    if (type === 'orientation' && !permissionStore.hasOrientationPermissionRequest() && status !== 'granted') return 'Unavailable';
    if (status === 'denied') return 'Re-request Permission';
    if (status === 'granted') return 'Allowed';
    return 'Request Permission';
}

async function refreshStatuses(): Promise<void> {
    error.value = '';

    try {
        await permissionStore.refreshPermissionStatuses();
    } catch (err) {
        error.value = err instanceof Error ? err.message : 'Failed to refresh permission status';
    }
}

async function requestPermission(type: PermissionKey): Promise<void> {
    error.value = '';
    working.value = type;

    try {
        switch (type) {
            case 'location':
                await permissionStore.requestLocationPermission(() => {
                    mapStore.startGPSWatch();
                });
                break;
            case 'camera':
                await permissionStore.requestCameraPermission();
                break;
            case 'orientation':
                await permissionStore.requestOrientationPermission();
                break;
            case 'fileSystem':
                await permissionStore.requestFileSystemPermission();
                break;
            case 'storage':
                await permissionStore.requestStoragePermission();
                break;
            case 'wakeLock':
                await permissionStore.requestWakeLockPermission();
                break;
            case 'notification':
                await permissionStore.requestNotificationPermission();
                break;
        }
    } catch (err) {
        error.value = err instanceof Error ? err.message : `Failed to request ${type} permission`;
    } finally {
        working.value = undefined;
        await refreshStatuses();
    }
}
</script>
