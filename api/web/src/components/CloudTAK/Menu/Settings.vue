<template>
<div>
    <template v-if='mode === "callsign"'>
        <MenuTemplate name='Callsign &amp; Device'>
            <div class='mx-2'>
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
        </MenuTemplate>
    </template>
    <template v-if='mode === "display"'>
        <MenuTemplate name='Display Preferences'>
            <div class='mx-2'>
                <div class='col-12'>
                    <TablerEnum
                        label='Remove Stale Elements'
                        v-model='profile.display_stale'
                        :options='[
                            "Immediate",
                            "10 Minutes",
                            "30 Minutes",
                            "1 Hour",
                            "Never"
                        ]'
                    />
                </div>
                <div class='col-12'>
                    <TablerEnum
                        label='Distance Unit'
                        v-model='profile.display_distance'
                        :options='[
                            "meter",
                            "kilometer",
                            "mile"
                        ]'
                    />
                </div>
                <div class='col-12'>
                    <TablerEnum
                        label='Elevation Unit'
                        v-model='profile.display_elevation'
                        :options='[
                            "meter",
                            "feet"
                        ]'
                    />
                </div>
                <div class='col-12'>
                    <TablerEnum
                        label='Speed Unit'
                        v-model='profile.display_speed'
                        :options='[
                            "m/s",
                            "km/h",
                            "mi/h"
                        ]'
                    />
                </div>
                <div class='col-12 d-flex py-3'>
                    <div class='ms-auto'>
                        <button @click='updateProfile' class='btn btn-primary'>Update</button>
                    </div>
                </div>
            </div>
        </MenuTemplate>
    </template>
    <template v-else-if='mode === "settings"'>
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
</div>
</template>

<script>
import MenuTemplate from '../util/MenuTemplate.vue';
import { std } from '/src/std.ts';
import {
    IconUserCog,
    IconAdjustments,
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
        MenuTemplate,
    }
}
</script>
