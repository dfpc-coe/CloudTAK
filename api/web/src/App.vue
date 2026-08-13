<template>
    <div
        class='page h-100'
        :class='appStore.resolvedTheme === "dark" ? "cloudtak-gradient" : "cloudtak-gradient-light"'
        :data-bs-theme='appStore.resolvedTheme'
        data-bs-theme-base='neutral'
        data-bs-theme-primary='blue'
    >
        <!-- New-version upgrade banner -->
        <div
            v-if='updateAvailable'
            class='d-flex align-items-center justify-content-center flex-wrap gap-2 px-3 pb-2'
            style='background: rgba(20,20,20,0.88); backdrop-filter: blur(6px); padding-top: calc(0.5rem + var(--status-bar-height, 0px));'
        >
            <IconRefresh
                size='16'
                class='text-success flex-shrink-0'
            />
            <span class='text-white small'>
                A new version of CloudTAK is ready
            </span>
            <button
                class='btn btn-sm btn-success py-0'
                @click='applyUpdate'
            >
                Update Now
            </button>
            <button
                class='btn-close btn-close-white'
                style='font-size: 0.65rem;'
                @click='updateAvailable = false'
            />
        </div>
        <!-- Session expiry warning banner -->
        <div
            v-if='sessionWarningShown'
            class='d-flex align-items-center justify-content-center flex-wrap gap-2 px-3 pb-2'
            style='background: rgba(20,20,20,0.88); backdrop-filter: blur(6px); padding-top: calc(0.5rem + var(--status-bar-height, 0px));'
        >
            <IconClock
                size='16'
                class='text-warning flex-shrink-0'
            />
            <span class='text-white small'>
                Your session expires in <span v-text='sessionRemainingLabel' /> &mdash; sign in again to stay connected
            </span>
            <button
                class='btn btn-sm btn-warning py-0'
                @click='appStore.sessionExpired'
            >
                Sign In Again
            </button>
            <button
                class='btn-close btn-close-white'
                style='font-size: 0.65rem;'
                @click='sessionWarningDismissed = true'
            />
        </div>

        <Loading
            v-if='!mounted || (appStore.loading && !route.path.includes("configure") && !route.path.includes("login"))'
            :stage='appStore.loadingStage'
        />
        <router-view
            v-else
            @err='error = $event'
            @login='appStore.refreshLogin'
        />
        <TablerError
            v-if='error'
            :err='error'
            @close='error = undefined'
        />
        <ChannelChangeModal
            v-if='mapStore.channelChange'
            @close='mapStore.channelChange = false'
        />
        <NotificationToast
            v-for='n in toastNotifications'
            :id='n.id'
            :key='n.id'
            @close='TAKNotification.update(n.id, { toast: false })'
        />
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onErrorCaptured, onMounted, onUnmounted } from 'vue'
import { liveQuery } from 'dexie';
import { isTransientDbError } from './database.ts';
import { useRoute, useRouter } from 'vue-router';
// Tabler's stylesheet is loaded from src/style.scss via the <head> of each
// HTML entry point - only its JS behaviours are pulled in here.
import '@tabler/core/dist/js/tabler.min.js';
import {
    IconClock,
    IconRefresh,
} from '@tabler/icons-vue';
import Loading from './components/Loading.vue';
import {
    TablerError
} from '@tak-ps/vue-tabler';
import ChannelChangeModal from './components/CloudTAK/Menu/ChannelChangeModal.vue';
import NotificationToast from './components/CloudTAK/util/NotificationToast.vue';
import TAKNotification_ from './base/notification.ts';
const TAKNotification = TAKNotification_;
import { supportsServiceWorker } from './utils/capacitor.ts';
import { useObservable } from '@vueuse/rxjs';
import { from } from 'rxjs';
import { applyServiceWorkerUpdate } from './utils/service-worker.ts';

import { useAppStore } from './stores/app.ts';
import { useMapStore } from './stores/map.ts';
import { useDeviceStore } from './stores/device.ts';

const route = useRoute();
const router = useRouter();

const appStore = useAppStore();
const mapStore = useMapStore();
const deviceStore = useDeviceStore();

let removeNotificationAction: (() => void) | undefined;

const toastNotifications = useObservable(
    from(liveQuery(async () => {
        return (await TAKNotification.list()).filter((n) => n.toast && !n.read);
    }))
);
const updateAvailable = ref(false);
const pendingRegistration = ref<ServiceWorkerRegistration | null>(null);

const applyUpdate = () => {
    applyServiceWorkerUpdate(pendingRegistration.value);
};

const onSwUpdateAvailable = (e: Event) => {
    pendingRegistration.value = (e as CustomEvent).detail.registration;
    updateAvailable.value = true;
};

const mounted = ref(false);
const error = ref<Error | undefined>();

const SESSION_WARNING_MS = 30 * 60 * 1000;
const SESSION_CHECK_INTERVAL_MS = 30 * 1000;

const sessionRemainingMs = ref<number | null>(null);
const sessionWarningDismissed = ref(false);

let sessionExpiryTimer: ReturnType<typeof setInterval> | undefined;
let sessionExpiredHandled = false;

const sessionWarningShown = computed<boolean>(() => {
    return !sessionWarningDismissed.value
        && sessionRemainingMs.value !== null
        && sessionRemainingMs.value > 0
        && sessionRemainingMs.value <= SESSION_WARNING_MS
        && route.name !== 'login';
});

const sessionRemainingLabel = computed<string>(() => {
    if (sessionRemainingMs.value === null) return '';
    const minutes = Math.ceil(sessionRemainingMs.value / 60000);
    return minutes <= 1 ? 'less than a minute' : `${minutes} minutes`;
});

function checkSessionExpiry() {
    if (!appStore.user || !appStore.tokenExpiry) {
        sessionRemainingMs.value = null;
        sessionExpiredHandled = false;
        return;
    }

    const remaining = appStore.tokenExpiry - Date.now();
    sessionRemainingMs.value = remaining;

    if (remaining > SESSION_WARNING_MS) {
        // A fresh token was issued - re-arm the dismissed warning
        sessionWarningDismissed.value = false;
    } else if (remaining <= 0 && !sessionExpiredHandled) {
        sessionExpiredHandled = true;
        void appStore.sessionExpired();
    }
}

onErrorCaptured((err) => {
    const e = err instanceof Error ? err : new Error(String(err));

    if (isTransientDbError(e)) {
        return false;
    }

    if (e.message === '401') {
        // Popup Modal if reauthenticating vs initial login

        if (route.name !== 'login') {
            void appStore.routeLogin();
        }
    } else if (String(e) === 'Error: Authentication Required') {
        void appStore.routeLogin();
    } else {
        error.value = e;
    }
});

onMounted(async () => {
    // Always clear the loading splash, even if initialization throws (e.g. a
    // request times out on a native cold-start). Otherwise the app can get
    // permanently stuck on the loading component before the login page.

    // Register before any awaits so early promise rejections are captured
    window.addEventListener('unhandledrejection', (e) => {
        const err = e.reason instanceof Error ? e.reason : new Error(String(e.reason));
        if (isTransientDbError(err)) {
            return;
        }
        error.value = err;
    });

    if (supportsServiceWorker()) {
        window.addEventListener('sw:update-available', onSwUpdateAvailable);
    }

    // Deep link when the user taps a push notification (path from its payload)
    removeNotificationAction = deviceStore.onNotificationAction((data) => {
        if (data && typeof data.url === 'string' && data.url.startsWith('/')) {
            router.push(data.url).catch((err: unknown) => {
                console.error('Failed to open push notification link', err);
            });
        }
    });

    try {
        await appStore.bootstrap();
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        appStore.loading = false;
        mounted.value = true;
    }

    checkSessionExpiry();
    sessionExpiryTimer = setInterval(checkSessionExpiry, SESSION_CHECK_INTERVAL_MS);
});

onUnmounted(() => {
    window.removeEventListener('sw:update-available', onSwUpdateAvailable);
    if (removeNotificationAction) removeNotificationAction();

    if (sessionExpiryTimer !== undefined) {
        clearInterval(sessionExpiryTimer);
        sessionExpiryTimer = undefined;
    }

    appStore.teardown();
});

</script>
