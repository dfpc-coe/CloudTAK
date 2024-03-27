<template>
<div>
    <template v-if='mode === "callsign"'>
        <div class='col-12 border-bottom border-light'>
            <div class='modal-header px-0 mx-2'>
                <IconCircleArrowLeft @click='mode = "settings"' size='32' class='cursor-pointer'/>
                <div class='modal-title'>Callsign &amp; Device</div>
            </div>
        </div>
        <div class='col-12 px-2 py-2'>
            <TablerLoading v-if='loading'/>
            <template v-else>
                <div class='col-12'>
                    <TablerInput label='User Callsign' v-model='profile.tak_callsign'/>
                </div>
                <div class='col-12'>
                    <TablerEnum label='User Group' v-model='profile.tak_group' :options='tak_groups'/>
                </div>
                <div class='col-12'>
                    <TablerEnum label='User Role' v-model='profile.tak_role' :options='tak_roles'/>
                </div>
                <div class='col-12 d-flex py-3'>
                    <div class='ms-auto'>
                        <button @click='updateProfile' class='btn btn-primary'>Update</button>
                    </div>
                </div>
            </template>
        </div>
    </template>
    <template v-if='mode === "display"'>
        <div class='col-12 border-bottom border-light'>
            <div class='modal-header px-0 mx-2'>
                <IconCircleArrowLeft @click='mode = "settings"' size='32' class='cursor-pointer'/>
                <div class='modal-title'>Display Preferences</div>
            </div>
        </div>
        <div class='col-12 px-2 py-2'>
        </div>
    </template>
    <template v-else-if='mode === "settings"'>
        <div class='col-12 border-bottom border-light'>
            <div class='modal-header px-0 mx-2'>
                <IconCircleArrowLeft @click='$router.back()' size='32' class='cursor-pointer'/>
                <div class='modal-title'>Settings</div>
            </div>
        </div>
        <div class='col-12'>
            <div @click='mode = "callsign"' class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
                <IconUserCog size='32'/>
                <span class='mx-2' style='font-size: 18px;'>Callsign &amp; Device Preferences</span>
            </div>
            <div @click='mode = "display"' class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
                <IconAdjustments size='32'/>
                <span class='mx-2' style='font-size: 18px;'>Display Preferences</span>
            </div>
        </div>
    </template>
</div>
</template>

<script>
import { std } from '/src/std.ts';
import {
    IconUserCog,
    IconAdjustments,
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
    name: 'CloudTAKSettings',
    data: function() {
        return {
            loading: false,
            mode: 'settings',
            profile: {},
            profileSchema: {}
        }
    },
    computed: {
        tak_groups: function() {
            return this.profileSchema.properties.tak_group.anyOf.map((a) => { return a.const });
        },
        tak_roles: function() {
            return this.profileSchema.properties.tak_role.anyOf.map((a) => { return a.const });
        }
    },
    mounted: async function() {
        this.loading = true;
        await this.fetchProfileSchema();
        await profileStore.load();
        this.profile = JSON.parse(JSON.stringify(profileStore.profile));
        this.loading = false;
    },
    methods: {
        fetchProfileSchema: async function() {
            this.profileSchema = (await std('/api/schema?method=PATCH&url=/profile')).body
        },
        updateProfile: async function() {
            await profileStore.update(this.profile);
            this.mode = 'settings';
        }
    },
    components: {
        IconUserCog,
        IconAdjustments,
        TablerInput,
        TablerEnum,
        TablerLoading,
        IconCircleArrowLeft
    }
}
</script>
