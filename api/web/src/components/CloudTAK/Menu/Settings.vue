<template>
<MenuTemplate name='Settings'>
    <div @click='mode = "callsign"' class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
        <IconUserCog size='32'/>
        <span class='mx-2' style='font-size: 18px;'>Callsign &amp; Device Preferences</span>
    </div>
    <div @click='mode = "display"' class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
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
import { useProfileStore } from '/src/stores/profile.js';
const profileStore = useProfileStore();

export default {
    name: 'CloudTAKSettings',
    data: function() {
        return {
            loading: false,
            mode: 'settings',
            profile: {},
        }
    },
    mounted: async function() {
        this.loading = true;
        await profileStore.load();
        this.profile = JSON.parse(JSON.stringify(profileStore.profile));
        this.loading = false;
    },
    methods: {
        updateProfile: async function() {
            await profileStore.update(this.profile);
            this.mode = 'settings';
        }
    },
    components: {
        IconUserCog,
        IconAdjustments,
        MenuTemplate,
    }
}
</script>
