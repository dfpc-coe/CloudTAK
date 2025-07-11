<template>
    <MenuTemplate name='Settings'>
        <MenuItem
            @click='router.push("/menu/settings/callsign")'
            @keyup.enter='router.push("/menu/settings/callsign")'
        >
            <IconUserCog
                :size='32'
                stroke='1'
            />
            <span
                class='mx-2'
                style='font-size: 18px;'
            >Callsign &amp; Device Preferences</span>
        </MenuItem>
        <MenuItem
            @click='router.push("/menu/settings/display")'
            @keyup.enter='router.push("/menu/settings/display")'
        >
            <IconAdjustments
                :size='32'
                stroke='1'
            />
            <span
                class='mx-2'
                style='font-size: 18px;'
            >Display Preferences</span>
        </MenuItem>
        <MenuItem
            @click='router.push("/menu/settings/tokens")'
            @keyup.enter='router.push("/menu/settings/tokens")'
        >
            <IconRobot
                :size='32'
                stroke='1'
            />
            <span
                class='mx-2'
                style='font-size: 18px;'
            >API Tokens</span>
        </MenuItem>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { useRouter } from 'vue-router';
import MenuTemplate from '../util/MenuTemplate.vue';
import MenuItem from '../util/MenuItem.vue'
import {
    IconRobot,
    IconUserCog,
    IconAdjustments,
} from '@tabler/icons-vue';

const router = useRouter();
</script>
