<template>
<MenuTemplate name='Settings'>
    <div @click='$router.push("/menu/settings/callsign")' class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
        <IconUserCog size='32'/>
        <span class='mx-2' style='font-size: 18px;'>Callsign &amp; Device Preferences</span>
    </div>
    <div @click='$router.push("/menu/settings/display")' class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
        <IconAdjustments size='32'/>
        <span class='mx-2' style='font-size: 18px;'>Display Preferences</span>
    </div>
</MenuTemplate>
</template>

<script>
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    IconUserCog,
    IconAdjustments,
} from '@tabler/icons-vue';

export default {
    name: 'CloudTAKSettings',
    data: function() {
        return {
            loading: false,
        }
    },
    components: {
        IconUserCog,
        IconAdjustments,
        MenuTemplate,
    }
}
</script>
