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
                            text-color='var(--tblr-body-color)'
                            class='text-uppercase flex-shrink-0'
                            v-bind='badgeProps(item.status)'
                        >
                            {{ badgeLabel(item.status) }}
                        </TablerBadge>
                    </div>

                    <div
                        v-if='shouldShowAction(item.key, item.status)'
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

        <TablerModal
            v-if='disclosure'
            size='lg'
        >
            <LocationDisclosure
                :stage='disclosure'
                :settings='disclosureOpensSettings'
                :working='Boolean(working)'
                @accept='acceptDisclosure'
                @decline='disclosure = undefined'
            />
        </TablerModal>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import type { Component } from 'vue';
import {
    IconBell,
    IconCamera,
    IconCompass,
    IconCurrentLocation,
    IconDatabase,
    IconFolderOpen,
    IconMapPin,
    IconRefresh,
    IconSun,
} from '@tabler/icons-vue';
import { TablerBadge, TablerIconButton, TablerModal } from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';
import StandardItem from '../util/StandardItem.vue';
import LocationDisclosure from '../util/LocationDisclosure.vue';
import type { LocationDisclosureStage } from '../util/LocationDisclosure.vue';
import { isNativePlatform, addAppLifecycleListeners } from '../../../utils/capacitor.ts';
import { useMapStore } from '../../../stores/map.ts';
import { useDeviceStore } from '../../../stores/device.ts';
import type { BrowserPermissionState } from '../../../stores/device.ts';

const mapStore = useMapStore();
const deviceStore = useDeviceStore();
type PermissionKey = 'location' | 'backgroundLocation' | 'notification' | 'orientation' | 'storage' | 'camera' | 'wakeLock' | 'fileSystem';
type PermissionDescriptor = {
    key: PermissionKey;
    title: string;
    icon: Component;
};
type PermissionStatusText = Record<PermissionKey, string>;

const loading = ref(true);
const error = ref('');
const working = ref<PermissionKey | undefined>();
const disclosure = ref<LocationDisclosureStage | undefined>();

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
    key: 'backgroundLocation',
    title: 'Background Location',
    icon: IconCurrentLocation,
}, {
    key: 'orientation',
    title: 'Device Orientation',
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
        location: 'TAK.NZ can access your live position.',
        backgroundLocation: 'TAK.NZ can keep sharing your location while the app is in the background.',
        notification: 'TAK.NZ can deliver browser notifications.',
        orientation: 'TAK.NZ can access your device orientation for compass-based map rotation.',
        storage: 'TAK.NZ can persist local data storage for more reliable offline access.',
        camera: 'TAK.NZ can access your camera when needed.',
        wakeLock: 'TAK.NZ can keep the screen awake during active operations.',
        fileSystem: 'TAK.NZ can open local files for import and export workflows.'
    },
    denied: {
        location: 'Location access is currently blocked. Use the button below to try again.',
        backgroundLocation: 'Background location access is currently blocked. Use the button below to open Settings.',
        notification: 'Notification access is currently blocked. Use the button below to try again.',
        orientation: 'Device orientation access is currently blocked. Use the button below to try again.',
        storage: 'Persistent storage was not granted. Use the button below to try again.',
        camera: 'Camera access is currently blocked. Use the button below to try again.',
        wakeLock: 'Wake lock access is currently blocked. Use the button below to try again.',
        fileSystem: 'File system access is currently blocked. Use the button below to try again.'
    },
    prompt: {
        location: 'Location access has not been granted yet.',
        backgroundLocation: 'Background location access has not been granted yet.',
        notification: 'Notification access has not been granted yet.',
        orientation: 'Device orientation access has not been granted yet.',
        storage: 'Persistent storage has not been requested yet.',
        camera: 'Camera access has not been granted yet.',
        wakeLock: 'Wake lock access has not been granted yet.',
        fileSystem: 'File system access has not been granted yet.'
    },
    unsupported: {
        location: 'This browser does not support geolocation permissions.',
        backgroundLocation: 'Background location sharing is only available in the mobile app.',
        notification: 'This browser does not support notification permissions.',
        orientation: 'This browser does not support device orientation events.',
        storage: 'This browser does not support persistent storage requests.',
        camera: 'This browser does not support camera access requests.',
        wakeLock: 'This browser does not support wake lock requests.',
        fileSystem: 'This browser does not support file system access requests.'
    },
    unknown: {
        location: 'TAK.NZ could not determine the current location permission state.',
        backgroundLocation: 'TAK.NZ could not determine the current background location permission state.',
        notification: 'TAK.NZ could not determine the current notification permission state.',
        orientation: 'TAK.NZ could not determine the current device orientation permission state.',
        storage: 'TAK.NZ could not determine the current persistent storage state.',
        camera: 'TAK.NZ could not determine the current camera permission state.',
        wakeLock: 'TAK.NZ could not determine the current wake lock state.',
        fileSystem: 'TAK.NZ could not determine the current file system access state.'
    }
};

const permissionItems = computed(() => {
    return permissionDescriptors
        .filter((permission) => permission.key !== 'backgroundLocation' || isNativePlatform())
        .map((permission) => {
            const status = deviceStore.permissions[permission.key];

            return {
                ...permission,
                status,
                description: descriptionFor(permission.key, status)
            };
        });
});

// Coming back from the system settings: pick up whatever the user changed there
let removeResumeListener: (() => void) | undefined;
onMounted(async () => {
    removeResumeListener = await addAppLifecycleListeners({ resume: () => { void refreshStatuses(); } });
    await refreshStatuses();
    loading.value = false;
});
onBeforeUnmount(() => removeResumeListener?.());

// A status, not an action: this badge is not a button. The button is below the description.
function badgeLabel(status: BrowserPermissionState): string {
    switch (status) {
        case 'granted': return 'Allowed';
        case 'when_in_use': return 'While Using';
        case 'denied': return 'Denied';
        case 'prompt': return 'Not asked yet';
        case 'unsupported': return 'Unsupported';
        default: return 'Unknown';
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

function descriptionFor(type: PermissionKey, status: BrowserPermissionState): string {
    if (status === 'when_in_use') {
        return 'Location is only shared while TAK.NZ is open. Set Location to "Always" in Settings so your team keeps seeing you when the app is in the background.';
    }

    if (isNativePlatform() && status !== 'granted' && status !== 'unsupported') {
        if (status === 'denied') return `${permissionDescriptions.denied[type].split('. ')[0]}.`;
        if (status === 'prompt') return permissionDescriptions.prompt[type];
        return permissionDescriptions.unknown[type];
    }

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

// Native prompts are only ever shown for location, and only from behind the
// disclosure; a denied permission is re-granted from system settings.
function offersNativeRequest(type: PermissionKey, status: BrowserPermissionState): boolean {
    if (!isNativePlatform()) return false;
    if (type === 'location') return status === 'prompt' || status === 'denied';
    if (type === 'backgroundLocation') {
        return deviceStore.permissions.location === 'granted'
            && ['prompt', 'when_in_use', 'denied'].includes(status);
    }
    // Camera and notifications are asked for directly. Android stops showing the
    // prompt once it has been refused, so a denied one opens the system settings
    // instead (see runRequest), as location does
    if (type === 'camera' || type === 'notification') return status === 'prompt' || status === 'denied';
    return false;
}

const disclosureOpensSettings = computed(() => {
    const type = disclosure.value === 'background' ? 'backgroundLocation' : 'location';
    return isNativePlatform() && deviceStore.permissions[type] === 'denied';
});

function canRequest(type: PermissionKey, status: BrowserPermissionState): boolean {
    if (offersNativeRequest(type, status)) return true;
    if (isNativePlatform()) return false;

    if (type === 'orientation' && !deviceStore.orientation.hasPermissionRequest() && status !== 'granted') {
        return false;
    }

    return status !== 'granted' && status !== 'unsupported';
}

function shouldShowAction(type: PermissionKey, status: BrowserPermissionState): boolean {
    if (offersNativeRequest(type, status)) return true;
    return !isNativePlatform() && status !== 'granted' && status !== 'unsupported';
}

function actionLabel(status: BrowserPermissionState, type: PermissionKey): string {
    if (working.value === type) return 'Requesting...';
    if (isNativePlatform() && status === 'denied') return 'Open Settings';
    if (type === 'orientation' && !deviceStore.orientation.hasPermissionRequest() && status !== 'granted') return 'Unavailable';
    if (status === 'denied') return 'Re-request Permission';
    if (status === 'granted') return 'Allowed';
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

// Location consent is collected on the disclosure before any system prompt
// or settings hand-off (Play prominent disclosure requirement).
async function requestPermission(type: PermissionKey): Promise<void> {
    if (type === 'location' || type === 'backgroundLocation') {
        error.value = '';
        disclosure.value = type === 'backgroundLocation' ? 'background' : 'location';
        return;
    }

    // On the native app only the permissions that can be asked for from here do anything
    if (isNativePlatform() && !offersNativeRequest(type, deviceStore.permissions[type])) return;

    await runRequest(type);
}

async function acceptDisclosure(): Promise<void> {
    const type: PermissionKey = disclosure.value === 'background' ? 'backgroundLocation' : 'location';
    disclosure.value = undefined;
    await runRequest(type);
}

async function runRequest(type: PermissionKey): Promise<void> {
    error.value = '';
    working.value = type;

    try {
        switch (type) {
            case 'location':
                if (isNativePlatform() && deviceStore.permissions.location === 'denied') {
                    await deviceStore.geolocation.openNativeSettings();
                    break;
                }
                await deviceStore.geolocation.request(() => {
                    void mapStore.startLocationWatch();
                });
                break;
            case 'backgroundLocation':
                if (deviceStore.permissions.backgroundLocation === 'denied') {
                    await deviceStore.geolocation.openNativeSettings();
                    break;
                }
                await deviceStore.geolocation.requestBackground();
                break;
            case 'camera':
                if (isNativePlatform() && deviceStore.permissions.camera === 'denied') {
                    await deviceStore.openAppSettings();
                    break;
                }
                await deviceStore.camera.request();
                break;
            case 'orientation':
                await deviceStore.orientation.request();
                break;
            case 'fileSystem':
                await deviceStore.fileSystem.request();
                break;
            case 'storage':
                await deviceStore.storage.request();
                break;
            case 'wakeLock':
                await deviceStore.wakeLock.request();
                break;
            case 'notification':
                if (isNativePlatform() && deviceStore.permissions.notification === 'denied') {
                    await deviceStore.openAppSettings();
                    break;
                }
                await deviceStore.notification.request();
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
