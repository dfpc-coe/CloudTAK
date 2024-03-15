<template>
<div>
    <div class="card-header">
        <h3 class="card-title">User Groups</h3>

        <div class='ms-auto btn-list'>
            <IconRefresh @click='fetch' size='32' class='cursor-pointer' v-tooltip='"Refresh"'/>
        </div>
    </div>
    <TablerLoading v-if='loading'/>
    <TablerNone v-else-if='!rawChannels.length' :create='false'/>
    <div v-else class='table-responsive'>
        <table class="table card-table table-hover table-vcenter">
            <thead>
                <tr>
                    <th>Group Name</th>
                    <th>Description</th>
                </tr>
            </thead>
            <tbody>
                <tr :key='group.name' v-for='group in processChannels'>
                    <td>
                        <div class='d-flex'>
                            <IconEye v-if='group.active' @click='setStatus(group, false)' v-tooltip='"Disable"' size='32' class='cursor-pointer'/>
                            <IconEyeOff v-else @click='setStatus(group, true)' v-tooltip='"Enable"' size='32' class='cursor-pointer'/>
                            <span class='mx-2' v-text='group.name'/>
                        </div>
                    </td>
                    <td v-text='group.description'></td>
                </tr>
            </tbody>
        </table>
    </div>
</div>
</template>

<script>
import {
    IconEye,
    IconEyeOff,
    IconRefresh
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'ConnectionGroups',
    data: function() {
        return {
            loading: true,
            rawChannels: []
        }
    },
    mounted: async function() {
        await this.fetch();
    },
    computed: {
        processChannels: function() {
            const channels = {};

            JSON.parse(JSON.stringify(this.rawChannels)).sort((a, b) => {
                return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
            }).forEach((channel) => {
                if (channels[channel.name]) {
                    channels[channel.name].direction.push(channel.direction);
                } else {
                    channel.direction = [channel.direction];
                    channels[channel.name] = channel;
                }
            });

            return channels;
        }
    },
    methods: {
        fetch: async function() {
            this.loading = true;
            this.rawChannels = (await window.std(`/api/connection/${this.$route.params.connectionid}/channel`)).data;
            this.loading = false;
        },
        setStatus: async function(channel, active=false) {
            this.rawChannels = this.rawChannels.map((ch) => {
                if (ch.name === channel.name) ch.active = active;
                return ch;
            });

            const url = window.stdurl('/api/marti/group');
            url.searchParams.append('connection', this.$route.params.connectionid);
            await window.std(url, {
                method: 'PUT',
                body: this.rawChannels
            });

            this.$emit('reset');
        },
    },
    components: {
        IconEye,
        IconEyeOff,
        IconRefresh,
        TablerNone,
        TablerLoading
    }
}
</script>
