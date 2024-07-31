<template>
    <MenuTemplate name='Settings'>
        <div
            class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'
            @click='$router.push("/menu/settings/callsign")'
        >
            <IconUserCog
                :size='32'
                :stroke='1'
            />
            <span
                class='mx-2'
                style='font-size: 18px;'
            >Callsign &amp; Device Preferences</span>
        </div>
        <div
            class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'
            @click='$router.push("/menu/settings/display")'
        >
            <IconAdjustments
                :size='32'
                :stroke='1'
            />
            <span
                class='mx-2'
                style='font-size: 18px;'
            >Display Preferences</span>
        </div>
        <div
            class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'
            @click='$router.push("/menu/settings/tokens")'
        >
            <IconRobot
                :size='32'
                :stroke='1'
            />
            <span
                class='mx-2'
                style='font-size: 18px;'
            >API Tokens</span>
        </div>
    </MenuTemplate>
</template>

<script>
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    IconRobot,
    IconUserCog,
    IconAdjustments,
} from '@tabler/icons-vue';

export default {
    name: 'CloudTAKSettings',
    components: {
        IconRobot,
        IconUserCog,
        IconAdjustments,
        MenuTemplate,
    },
    data: function() {
        return {
            loading: false,
        }
    }
}
</script>
