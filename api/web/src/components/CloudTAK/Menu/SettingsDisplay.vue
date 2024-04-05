<template>
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
            this.$router.push("/menu/settings");
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
