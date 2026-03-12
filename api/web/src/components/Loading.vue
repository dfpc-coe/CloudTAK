<template>
    <div class='page page-center'>
        <div class='container container-normal py-4'>
            <div class='row align-items-center g-4'>
                <div class='col-lg'>
                    <div class='container-tight'>
                        <div class='card card-md'>
                            <div class='card-body'>
                                <div
                                    class='text-center'
                                    style='margin-bottom: 24px;'
                                >
                                    <img
                                        alt='Agency Logo'
                                        :src='logo'
                                        draggable='false'
                                        style='height: 150px;'
                                    >
                                </div>
                                <TablerLoading desc='Loading CloudTAK' />
                                <Transition name='reset-fade'>
                                    <div
                                        v-if='showReset'
                                        class='text-center mt-3'
                                    >
                                        <button
                                            class='btn btn-danger'
                                            @click='hardReset'
                                        >
                                            Hard Reset
                                        </button>
                                        <div class='text-muted mt-1' style='font-size: 0.8rem;'>
                                            If loading has stalled, click to clear the cache and reload.
                                        </div>
                                    </div>
                                </Transition>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import Config from '../base/config.ts';
import { ref, onMounted, onUnmounted } from 'vue'
import {
    TablerLoading
} from '@tak-ps/vue-tabler'

const logo = ref('/CloudTAKLogo.svg');
const showReset = ref(false);
let resetTimer: ReturnType<typeof setTimeout> | undefined;

async function hardReset(): Promise<void> {
    if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
            await registration.unregister();
        }
    }
    location.reload();
}

onMounted(async () => {
    const config = await Config.list(['login::logo']);

    if (config['login::logo']) {
        logo.value = config['login::logo'];
    }

    resetTimer = setTimeout(() => {
        showReset.value = true;
    }, 20000);
});

onUnmounted(() => {
    clearTimeout(resetTimer);
});
</script>

<style scoped>
.reset-fade-enter-active {
    transition: opacity 1s ease-in;
}
.reset-fade-enter-from {
    opacity: 0;
}
</style>
