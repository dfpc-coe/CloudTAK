<template>
    <div class='d-flex flex-column align-items-center'>
        <div
            title='Return Home'
            class='position-relative cursor-pointer cloudtak-hover'
            role='button'
            tabindex='0'
            @click='handleHomeClick'
            @keyup.enter='handleHomeClick'
        >
            <img
                :src='logo'
                :height='props.size'
                :width='props.size'
                alt='Server Logo'
            >
            <div
                class='server-status-dot position-absolute'
                :class='`status-${state}`'
                role='status'
                :title='label'
                :aria-label='label'
            />
        </div>
        <div
            v-if='props.version'
            class='subheader text-white mt-1'
            v-text='serverVersion'
        />
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useMapStore } from '../../stores/map.ts';
import { supportsServiceWorker } from '../../utils/capacitor.ts';
import Config from '../../base/config.ts';
import { connectionState, RECONNECT_GRACE_MS } from '../../utils/connection-state.ts';

const props = defineProps<{
    version?: boolean;
    size?: number;
}>();

const router = useRouter();
const mapStore = useMapStore();

const logo = ref('/CloudTAKLogo.svg');
const serverVersion = ref('');

const now = ref(Date.now());

const state = computed(() => connectionState({
    isOpen: mapStore.isOpen,
    isOnline: mapStore.isOnline,
    closedAt: mapStore.connectionClosedAt,
    now: now.value
}));

const label = computed(() => {
    if (state.value === 'connected') return 'Server connected';
    if (state.value === 'reconnecting') return 'Server reconnecting';
    return 'Server disconnected';
});

let graceTimer: ReturnType<typeof setTimeout> | undefined;

watch(() => mapStore.connectionClosedAt, (closedAt) => {
    clearTimeout(graceTimer);
    now.value = Date.now();
    if (closedAt === null) return;

    graceTimer = setTimeout(() => {
        now.value = Date.now();
    }, Math.max(closedAt + RECONNECT_GRACE_MS - now.value, 0) + 1);
}, { immediate: true });

let alive = false;
onMounted(() => { alive = true; });
onUnmounted(() => {
    alive = false;
    clearTimeout(graceTimer);
});

onMounted(async () => {
    const loginConfig = await Config.list(['login::logo']);
    if (!alive) return;

    const loginLogo = loginConfig['login::logo'];
    if (typeof loginLogo === 'string' && loginLogo) {
        logo.value = loginLogo;
    }

    if (supportsServiceWorker()) {
        const pkg = await navigator.serviceWorker.getRegistration();
        if (pkg && pkg.active) {
            const url = new URL(pkg.active.scriptURL);
            if (alive && url.searchParams.get('v')) {
                serverVersion.value = String(url.searchParams.get('v'));
            }
        }
    }

    if (alive && !serverVersion.value) {
        serverVersion.value = (await mapStore.worker.profile.loadServer()).version;
    }
});

function handleHomeClick() {
    router.push('/');
    mapStore.returnHome();
}
</script>

<style scoped>
.server-status-dot {
    height: 10px;
    width: 10px;
    bottom: 2px;
    right: 2px;
    border-radius: 50%;
}

.status-connected {
    background-color: #2fb344;
}

.status-reconnecting {
    background-color: #f76707;
    animation: server-status-pulse 1.2s ease-in-out infinite;
}

.status-disconnected {
    background-color: #d63939;
}

@keyframes server-status-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
}

@media (prefers-reduced-motion: reduce) {
    .status-reconnecting {
        animation: none;
    }
}
</style>
