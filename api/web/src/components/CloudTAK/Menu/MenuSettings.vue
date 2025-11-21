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
        </div>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { useRouter } from 'vue-router';
import MenuTemplate from '../util/MenuTemplate.vue';
import MenuItemCard from './MenuItemCard.vue';
import {
    IconRobot,
    IconUserCog,
    IconAdjustments,
} from '@tabler/icons-vue';

const router = useRouter();
</script>
