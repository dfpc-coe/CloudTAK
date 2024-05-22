<template>
    <MenuTemplate
        name='Mission Subscribers'
        :back='false'
        :border='false'
    >
        <TablerNone
            v-if='!subscriptions.length'
            :create='false'
        />
        <div
            v-for='sub of subscriptions'
            v-else
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
import {
    TablerNone
} from '@tak-ps/vue-tabler';
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
        TablerNone,
        IconUserBolt,
        IconUserEdit,
        IconUser
    },
    data: function() {
        return {
            subscriptions: []
        }
    },
    methods: {
        fetchSubscriptions: async function() {
            try {
                const url = await stdurl(`/api/marti/missions/${this.mission.name}/subscriptions/roles`);
                this.subscriptions = (await std(url)).data;
            } catch (err) {
                this.err = err;
            }
            this.loading.users = false;
        },
    }
}
</script>
