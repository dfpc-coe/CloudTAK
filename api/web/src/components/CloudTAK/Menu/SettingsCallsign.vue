<template>
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

<script>
import MenuTemplate from '../util/MenuTemplate.vue';
import { std } from '/src/std.ts';
import {
    TablerInput,
    TablerEnum,
    TablerLoading
} from '@tak-ps/vue-tabler';
import { useProfileStore } from '/src/stores/profile.ts';
const profileStore = useProfileStore();

export default {
    name: 'CloudTAKSettingsCallsign',
    data: function() {
        return {
            loading: true,
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
        TablerInput,
        TablerEnum,
        TablerLoading,
        MenuTemplate,
    }
}
</script>
