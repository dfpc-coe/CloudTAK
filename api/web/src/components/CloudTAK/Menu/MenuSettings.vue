<template>
    <MenuTemplate name='Settings'>
        <div class='col-12 d-flex flex-column gap-2 p-3'>
            <StandardItem
                @click='router.push("/menu/settings/callsign")'
            >
                <div class='d-flex align-items-center px-2 py-2'>
                    <IconUserCog
                        :size='32'
                        stroke='1'
                    />
                    <div class='ms-2 flex-grow-1 font-weight-bold'>
                        Callsign & Device Preferences
                    </div>
                </div>
            </StandardItem>
            <StandardItem
                @click='router.push("/menu/settings/display")'
            >
                <div class='d-flex align-items-center px-2 py-2'>
                    <IconAdjustments
                        :size='32'
                        stroke='1'
                    />
                    <div class='ms-2 flex-grow-1 font-weight-bold'>
                        Display Preferences
                    </div>
                </div>
            </StandardItem>
            <StandardItem
                @click='router.push("/menu/settings/tokens")'
            >
                <div class='d-flex align-items-center px-2 py-2'>
                    <IconRobot
                        :size='32'
                        stroke='1'
                    />
                    <div class='ms-2 flex-grow-1 font-weight-bold'>
                        API Tokens
                    </div>
                </div>
            </StandardItem>
            <StandardItem
                @click='refreshApp()'
            >
                <div class='d-flex align-items-center px-2 py-2'>
                    <IconRefresh
                        :size='32'
                        stroke='1'
                    />
                    <div class='ms-2 flex-grow-1 font-weight-bold'>
                        Refresh App
                    </div>
                </div>
            </StandardItem>
        </div>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { useRouter } from 'vue-router';
import MenuTemplate from '../util/MenuTemplate.vue';
import StandardItem from '../util/StandardItem.vue';
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

