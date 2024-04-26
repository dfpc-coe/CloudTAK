<template>
<MenuTemplate name='Channels'>
    <template #buttons>
        <IconSearch v-if='rawChannels.length' @click='search.shown = !search.shown' v-tooltip='"Search"' size='32' class='cursor-pointer'/>
        <IconRefresh v-if='!loading' @click='fetchList' size='32' class='cursor-pointer' v-tooltip='"Refresh"'/>
    </template>
    <template #default>
        <div v-if='search.shown' class='col-12 px-3'>
            <TablerInput v-model='search.filter' placeholder='Filter'/>
        </div>

        <TablerLoading v-if='loading'/>
        <TablerNone v-else-if='!Object.keys(processChannels).length' :create='false'/>
        <template v-else>
            <div :key='ch.name' v-for='ch in processChannels' class="col-lg-12 hover-dark">
                <div class='hover-dark'>
                    <div class='px-2'>
                        <div class='col-12 py-2 px-2 d-flex align-items-center'>
                            <IconEye v-if='ch.active' @click='setStatus(ch, false)' v-tooltip='"Disable"' size='32' class='cursor-pointer'/>
                            <IconEyeOff v-else @click='setStatus(ch, true)' v-tooltip='"Enable"' size='32' class='cursor-pointer'/>
                            <span class="mx-2" v-text='ch.name'></span>
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </template>
</MenuTemplate>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerNone,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    IconRefresh,
    IconSearch,
    IconEye,
    IconEyeOff,
} from '@tabler/icons-vue';

export default {
    name: 'CloudTAKChannels',
    data: function() {
        return {
            err: false,
            loading: true,
            search: {
                shown: false,
                filter: ''
            },
            rawChannels: []
        }
    },
    mounted: async function() {
        await this.fetchList();
    },
    watch: {
        'search.shown': function() {
            if (!this.search.shown) this.search.filter = '';
        }
    },
    computed: {
        processChannels: function() {
            const channels = {};

            JSON.parse(JSON.stringify(this.rawChannels))
                .sort((a, b) => {
                    return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
                }).forEach((channel) => {
                    if (channels[channel.name]) {
                        channels[channel.name].direction.push(channel.direction);
                    } else {
                        channel.direction = [channel.direction];
                        channels[channel.name] = channel;
                    }
                })

            for (const key of Object.keys(channels)) {
                if (this.search.shown && !key.includes(this.search.filter)) {
                    delete channels[key];
                }
            }

            return channels;
        }
    },
    methods: {
        setStatus: async function(channel, active=false) {
            this.rawChannels = this.rawChannels.map((ch) => {
                if (ch.name === channel.name) ch.active = active;
                return ch;
            });

            this.$emit('reset');

            const url = stdurl('/api/marti/group');
            await std(url, {
                method: 'PUT',
                body: this.rawChannels
            });
        },
        fetchList: async function() {
            this.loading = true;
            const url = stdurl('/api/marti/group');
            url.searchParams.append('useCache', 'true');
            this.rawChannels = (await std(url)).data;
            this.loading = false;
        },
    },
    components: {
        IconEye,
        IconEyeOff,
        IconSearch,
        IconRefresh,
        TablerNone,
        TablerInput,
        TablerLoading,
        MenuTemplate
    }
}
</script>
