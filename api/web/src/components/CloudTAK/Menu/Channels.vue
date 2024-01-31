<template>
<div>
    <div class='col-12 border-bottom border-light'>
        <div class='modal-header px-0 mx-2'>
            <IconCircleArrowLeft @click='$emit("close")' class='cursor-pointer'/>
            <div class='modal-title'>Channels</div>
            <div class='btn-list'>
                <IconRefresh v-if='!loading' @click='fetchList' class='cursor-pointer' v-tooltip='"Refresh"'/>
            </div>
        </div>
    </div>
    <div class='py-2 px-2'>
        <TablerLoading v-if='loading'/>
        <TablerNone v-else-if='!rawChannels.length' :create='false'/>
        <template v-else>
            <div :key='ch.name' v-for='ch in processChannels' class="col-lg-12 hover-dark">
                <div class='col-12 py-2 px-2 d-flex align-items-center'>
                    <IconEye v-if='ch.active' @click='setStatus(ch, false)' v-tooltip='"Disable"' class='cursor-pointer'/>
                    <IconEyeOff v-else @click='setStatus(ch, true)' v-tooltip='"Enable"' class='cursor-pointer'/>
                    <span class="mx-2" v-text='ch.name'></span>
                </div>
            </div>
        </template>
    </div>
</div>
</template>

<script>
import {
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler';

import {
    IconCircleArrowLeft,
    IconRefresh,
    IconEye,
    IconEyeOff,
} from '@tabler/icons-vue';

export default {
    name: 'Channels',
    data: function() {
        return {
            err: false,
            loading: true,
            rawChannels: []
        }
    },
    mounted: async function() {
        await this.fetchList();
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
        setStatus: async function(channel, active=false) {
            this.rawChannels = this.rawChannels.map((ch) => {
                if (ch.name === channel.name) ch.active = active;
                return ch;
            });

            const url = window.stdurl('/api/marti/group');
            await window.std(url, {
                method: 'PUT',
                body: this.rawChannels
            });

            this.$emit('reset');
        },
        fetchList: async function() {
            this.loading = true;
            const url = window.stdurl('/api/marti/group');
            url.searchParams.append('useCache', 'true');
            this.rawChannels = (await window.std(url)).data;
            this.loading = false;
        },
    },
    components: {
        IconEye,
        IconEyeOff,
        IconRefresh,
        TablerNone,
        TablerLoading,
        IconCircleArrowLeft,
    }
}
</script>
