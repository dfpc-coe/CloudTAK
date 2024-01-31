<template>
<div>
    <template v-if='mode === "callsign"'>
        <div class='col-12 border-bottom border-light'>
            <div class='modal-header px-0 mx-2'>
                <IconCircleArrowLeft @click='mode = "settings"' class='cursor-pointer'/>
                <div class='modal-title'>Callsign &amp; Device</div>
                <div/>
            </div>
        </div>
        <div class='col-12 px-2 py-2'>
            <TablerLoading v-if='loading'/>
            <template v-else>
                <div class='col-12'>
                    <TablerInput label='User Callsign' v-model='profile.tak_callsign'/>
                </div>
                <div class='col-12'>
                    <TablerEnum label='User Group' v-model='profile.tak_group' :options='profileSchema.properties.tak_group.enum'/>
                </div>
                <div class='col-12'>
                    <TablerEnum label='User Role' v-model='profile.tak_role' :options='profileSchema.properties.tak_role.enum'/>
                </div>
                <div class='col-12 d-flex py-3'>
                    <div class='ms-auto'>
                        <button @click='updateProfile' class='btn btn-primary'>Update</button>
                    </div>
                </div>
            </template>
        </div>
    </template>
    <template v-else-if='mode === "settings"'>
        <div class='col-12 border-bottom border-light'>
            <div class='modal-header px-0 mx-2'>
                <IconCircleArrowLeft @click='$emit("close")' class='cursor-pointer'/>
                <div class='modal-title'>Settings</div>
                <div/>
            </div>
        </div>
        <div class='col-12 px-2 py-2'>
            <div @click='mode = "callsign"' class='cursor-pointer col-12 py-2 px-2 d-flex align-items-center hover-dark'>
                <IconUserCog size='32'/>
                <span class='mx-2' style='font-size: 18px;'>Callsign &amp; Device Preferences</span>
            </div>
        </div>
    </template>
</div>
</template>

<script>
import {
    IconUserCog,
    IconCircleArrowLeft
} from '@tabler/icons-vue';
import {
    TablerInput,
    TablerEnum,
    TablerLoading
} from '@tak-ps/vue-tabler';
import { useProfileStore } from '/src/stores/profile.js';
const profileStore = useProfileStore();

export default {
    name: 'Settings',
    data: function() {
        return {
            loading: false,
            mode: 'settings',
            profile: {},
            profileSchema: {}
        }
    },
    mounted: async function() {
        await this.fetchProfileSchema();
        await profileStore.load();
        this.profile = JSON.parse(JSON.stringify(profileStore.profile));
    },
    methods: {
        fetchProfileSchema: async function() {
            this.loading = true;
            this.profileSchema = (await window.std('/api/schema?method=PATCH&url=/profile')).body
            this.loading = false;
        },
        updateProfile: async function() {
            this.loading = true;
            await profileStore.update(this.profile);
            this.mode = 'settings';
            this.loading = false;
        }
    },
    components: {
        IconUserCog,
        TablerInput,
        TablerEnum,
        TablerLoading,
        IconCircleArrowLeft
    }
}
</script>
