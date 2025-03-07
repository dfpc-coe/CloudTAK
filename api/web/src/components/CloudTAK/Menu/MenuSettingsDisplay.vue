<template>
    <MenuTemplate name='Display Preferences'>
        <div class='mx-2'>
            <TablerLoading v-if='loading' />
            <div
                v-else
                class='col-12'
            >
                <TablerEnum
                    v-model='profile.display_stale'
                    label='Remove Stale Elements'
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
                    v-model='profile.display_text'
                    label='Text Size'
                    :options='[
                        "Small",
                        "Medium",
                        "Large"
                    ]'
                />
            </div>
            <div class='col-12'>
                <TablerEnum
                    v-model='profile.display_distance'
                    label='Distance Unit'
                    :options='[
                        "meter",
                        "kilometer",
                        "mile"
                    ]'
                />
            </div>
            <div class='col-12'>
                <TablerEnum
                    v-model='profile.display_elevation'
                    label='Elevation Unit'
                    :options='[
                        "meter",
                        "feet"
                    ]'
                />
            </div>
            <div class='col-12'>
                <TablerEnum
                    v-model='profile.display_speed'
                    label='Speed Unit'
                    :options='[
                        "m/s",
                        "km/h",
                        "mi/h"
                    ]'
                />
            </div>
            <div class='col-12'>
                <TablerEnum
                    v-model='profile.display_projection'
                    label='Display Projection'
                    :options='[
                        "globe",
                        "mercator"
                    ]'
                />
            </div>
            <div class='col-12 d-flex py-3'>
                <div class='ms-auto'>
                    <button
                        class='btn btn-primary'
                        @click='updateProfile'
                    >
                        Update
                    </button>
                </div>
            </div>
        </div>
    </MenuTemplate>
</template>

<script>
import MenuTemplate from '../util/MenuTemplate.vue';
import { std } from '/src/std.ts';
import {
    TablerEnum,
    TablerLoading
} from '@tak-ps/vue-tabler';
import { useProfileStore } from '/src/stores/profile.ts';
const profileStore = useProfileStore();

export default {
    name: 'CloudTAKSettings',
    components: {
        TablerEnum,
        TablerLoading,
        MenuTemplate,
    },
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
    }
}
</script>
