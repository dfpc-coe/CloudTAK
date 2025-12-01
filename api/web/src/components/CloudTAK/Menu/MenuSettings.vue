<template>
    <MenuTemplate name='Settings'>
        <div class='col-12 d-flex flex-column gap-2 p-3'>
            <MenuItemCard
                :icon='IconUserCog'
                label='Callsign & Device Preferences'
                @select='router.push("/menu/settings/callsign")'
            />
            <MenuItemCard
                :icon='IconAdjustments'
                label='Display Preferences'
                @select='router.push("/menu/settings/display")'
            />
            <MenuItemCard
                :icon='IconRobot'
                label='API Tokens'
                @select='router.push("/menu/settings/tokens")'
            />
            <MenuItemCard
                :icon='IconRefresh'
                label='Refresh App'
                @select='refreshApp()'
            />
        </div>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { useRouter } from 'vue-router';
import MenuTemplate from '../util/MenuTemplate.vue';
import MenuItemCard from './MenuItemCard.vue';
import {
    IconRefresh,
    IconRobot,
    IconUserCog,
    IconAdjustments,
} from '@tabler/icons-vue';

const router = useRouter();

async function refreshApp() {
    if (!navigator.onLine) {
        throw new Error('Cannot refresh app while offline.');
    }

    if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
            await registration.unregister();
        }
    }

    if ('caches' in window) {
        const keys = await caches.keys();
        for (const key of keys) {
            await caches.delete(key);
        }
    }

    window.location.reload();
}
</script>

