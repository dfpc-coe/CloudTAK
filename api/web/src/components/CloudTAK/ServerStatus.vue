<template>
    <div class='d-flex flex-column align-items-center'>
        <div
            v-tooltip='"Return Home"'
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
                :class='{
                    "status-green": mapStore.isOpen,
                    "status-red": !mapStore.isOpen
                }'
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
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useMapStore } from '../../stores/map.ts';
import { supportsServiceWorker } from '../../base/capacitor.ts';
import Config from '../../base/config.ts';

const props = defineProps<{
    version?: boolean;
    size?: number;
}>();

const router = useRouter();
const mapStore = useMapStore();

const logo = ref('/CloudTAKLogo.svg');
const serverVersion = ref('');

let alive = false;
onMounted(() => { alive = true; });
onUnmounted(() => { alive = false; });

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

.status-green {
    background-color: #2fb344;
}

.status-red {
    background-color: #d63939;
}
</style>
