<template>
<div class='row'>
    <div class='col-12 border-bottom border-light'>
        <div class='modal-header px-0 mx-2'>
            <CircleArrowLeftIcon @click='$emit("close")' class='cursor-pointer'/>
            <div class='modal-title'>Channels</div>
            <div class='btn-list'>
                <RefreshIcon v-if='!loading' @click='fetchList' class='cursor-pointer' v-tooltip='"Refresh"'/>
            </div>
        </div>
    </div>
    <div class='row py-2 px-2'>
        <TablerLoading v-if='loading'/>
        <TablerNone v-else-if='!channels.size' :create='false'/>
        <template v-else>
            <div :key='ch.name' v-for='ch in channels.values()' class="col-lg-12 hover-dark">
                <div class='col-12 py-2 px-2 d-flex align-items-center'>
                    <EyeIcon v-if='ch.active'/>
                    <EyeOffIcon v-else/>
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
    CircleArrowLeftIcon,
    RefreshIcon,
    EyeIcon,
    EyeOffIcon,
} from 'vue-tabler-icons';

export default {
    name: 'Channels',
    props: {
        map: {
            type: Object,
            required: true
        }
    },
    data: function() {
        return {
            err: false,
            loading: true,
            channels: new Map()
        }
    },
    mounted: async function() {
        await this.fetchList();
    },
    methods: {
        fetchList: async function() {
            this.loading = true;
            const url = window.stdurl('/api/marti/group');
            url.searchParams.append('useCache', 'true');
            const channels = await window.std(url);

            console.error(channels);
            channels.data.sort((a, b) => {
                return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
            }).forEach((channel) => {
                if (this.channels.has(channel.name)) {
                    this.channels.get(channel.name).direction.push(channel.direction);
                } else {
                    channel.direction = [channel.direction];
                    this.channels.set(channel.name, channel);
                }
            });

            this.loading = false;
        },
    },
    components: {
        EyeIcon,
        EyeOffIcon,
        RefreshIcon,
        TablerNone,
        TablerLoading,
        CircleArrowLeftIcon,
    }
}
</script>
