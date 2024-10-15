<template>
    <MenuTemplate name='Callsign &amp; Device'>
        <div class='mx-2'>
            <TablerLoading v-if='loading' />
            <template v-else>
                <div class='col-12'>
                    <TablerInput
                        v-model='profile.tak_callsign'
                        label='User Callsign'
                    />
                </div>
                <div class='col-12'>
                    <TablerEnum
                        v-model='profile.tak_group'
                        label='User Group'
                        :options='tak_groups'
                    />
                </div>
                <div class='col-12'>
                    <TablerEnum
                        v-model='profile.tak_role'
                        label='User Role'
                        :options='tak_roles'
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
    components: {
        TablerInput,
        TablerEnum,
        TablerLoading,
        MenuTemplate,
    },
    data: function() {
        return {
            loading: true,
            profile: {},
            config: {}
        }
    },
    computed: {
        tak_groups: function() {
            const groups = [];
            for (const g in this.config.groups) {
                if (this.config.groups[g]) {
                    groups.push(`${g} - ${this.config.groups[g]}`);
                } else {
                    groups.push(g);
                }
            }

            return groups;
        },
        tak_roles: function() {
            return this.config.roles;
        }
    },
    mounted: async function() {
        this.loading = true;
        await this.fetchConfig();
        await profileStore.load();
        const profile = JSON.parse(JSON.stringify(profileStore.profile));
        profile.tak_groups
        this.profile = profile;

        this.loading = false;
    },
    methods: {
        fetchConfig: async function() {
            const config = await std('/api/config/group');
            const groups = {};
            for (const key in config.groups) {
                groups[key.replace('group::', '')] = config.groups[key];
            }

            this.config = {
                groups,
                roles: config.roles
            };
        },
        updateProfile: async function() {
            await profileStore.update(this.profile);
            this.$router.push("/menu/settings");
        }
    }
}
</script>
