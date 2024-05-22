<template>
    <MenuTemplate
        name='Mission Subscribers'
        :back='false'
        :border='false'
        :none='!subscriptions.length'
        :loading='loading'
    >
        <div
            v-for='sub of subscriptions'
        >
            <div class='col-12 py-2 px-2 d-flex hover-dark'>
                <div class='row col-12 align-items-center'>
                    <div class='col-auto mx-2'>
                        <div v-text='sub.username' />
                        <div
                            class='subheader'
                            v-text='sub.username'
                        />
                    </div>
                    <div class='col-auto ms-auto btn-list'>
                        <IconUserBolt
                            v-if='sub.role.type === "MISSION_OWNER"'
                            v-tooltip='sub.role.type'
                            size='32'
                        />
                        <IconUserEdit
                            v-else-if='sub.role.type === "MISSION_SUBSCRIBER"'
                            v-tooltip='sub.role.type'
                            size='32'
                        />
                        <IconUser
                            v-else-if='sub.role.type === "MISSION_READONLY_SUBSCRIBER"'
                            v-tooltip='sub.role.type'
                            size='32'
                        />
                    </div>
                </div>
            </div>
        </div>
    </MenuTemplate>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    IconUserBolt,
    IconUserEdit,
    IconUser
} from '@tabler/icons-vue';
import MenuTemplate from '../../util/MenuTemplate.vue';

export default {
    name: 'MissionUsers',
    components: {
        MenuTemplate,
        IconUserBolt,
        IconUserEdit,
        IconUser
    },
    props: {
        mission: Object
    },
    data: function() {
        return {
            loading: false,
            subscriptions: []
        }
    },
    mounted: async function() {
        await this.fetchSubscriptions();
    },
    methods: {
        fetchSubscriptions: async function() {
            this.loading = true;

            const url = await stdurl(`/api/marti/missions/${this.mission.name}/subscriptions/roles`);
            this.subscriptions = (await std(url)).data;

            this.loading = false;
        },
    }
}
</script>
