<template>
<div class='row'>
    <template v-if='mode === "callsign"'>
        <div class='col-12 border-bottom border-light'>
            <div class='modal-header px-0 mx-2'>
                <IconCircleArrowLeft @click='mode = "settings"' class='cursor-pointer'/>
                <div class='modal-title'>Callsign &amp; Device</div>
                <div/>
            </div>
        </div>
        <div class='col-12 row px-2 py-2'>
            <TablerLoading v-if='loading'/>
            <template v-else>
                <div class='col-12'>
                    <TablerInput label='User Callsign' v-model='profile.tak_callsign'/>
                </div>
                <div class='col-12'>
                    <TablerInput label='User Group' v-model='profile.tak_group'/>
                </div>
                <div class='col-12'>
                    <TablerInput label='User Role' v-model='profile.tak_role'/>
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
        <div class='col-12 row px-2 py-2'>
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
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'Settings',
    data: function() {
        return {
            loading: false,
            mode: 'settings',
            profile: {},
        }
    },
    watch: {
        mode: async function() {
            if (this.mode === 'callsign') {
                await this.fetchProfile();
            }
        }
    },
    methods: {
        fetchProfile: async function() {
            this.loading = true;
            this.profile = await window.std('/api/profile')
            this.loading = false;
        },
        updateProfile: async function() {
            this.loading = true;
            this.profile = await window.std('/api/profile', {
                method: 'PATCH',
                body: this.profile
            })

            this.mode = 'settings';
            this.loading = false;
        }
    },
    components: {
        IconUserCog,
        TablerInput,
        TablerLoading,
        IconCircleArrowLeft
    }
}
</script>
