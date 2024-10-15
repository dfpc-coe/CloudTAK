<template>
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
</template>

<script>
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
    },
    emits: [
        'update'
    ],
    data: function() {
        return {
            loading: true,
            profile: {},
            config: {}
        }
    },
    props: {
        mode: {
            type: String,
            default: 'router'
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

        if (this.config.groups[profile.tak_group]) {
            profile.tak_group = `${profile.tak_group} - ${this.config.groups[profile.tak_group]}`;
        }

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
            const profile = JSON.parse(JSON.stringify(this.profile));

            profile.tak_group = profile.tak_group.replace(/\s-\s.*$/, '');

            await profileStore.update(profile);
            if (this.mode === 'router') {
                this.$router.push("/menu/settings");
            } else {
                this.$emit('update');
            }
        }
    }
}
</script>
