<template>
    <MenuTemplate name='Channels'>
        <template #buttons>
            <IconSearch
                v-if='channels.length'
                v-tooltip='"Search"'
                :size='32'
                :stroke='1'
                class='cursor-pointer'
                @click='search.shown = !search.shown'
            />
            <IconRefresh
                v-if='!loading'
                v-tooltip='"Refresh"'
                :size='32'
                :stroke='1'
                class='cursor-pointer'
                @click='loadChannels'
            />
        </template>
        <template #default>
            <div
                v-if='!loading'
                class='col-12 px-2 pb-2'
            >
                <TablerInput
                    v-model='paging.filter'
                    icon='search'
                    placeholder='Filter'
                />
            </div>

            <NoChannelsInfo v-if='hasNoChannels' />

            <TablerLoading v-if='loading' />
            <TablerNone
                v-else-if='!Object.keys(processChannels).length'
                :create='false'
            />
            <template v-else>
                <div
                    v-for='ch in processChannels'
                    :key='ch.name'
                    class='col-lg-12 hover-dark'
                >
                    <div class='hover-dark'>
                        <div class='px-2'>
                            <div class='col-12 py-2 px-2 d-flex align-items-center'>
                                <IconEye
                                    v-if='ch.active'
                                    v-tooltip='"Disable"'
                                    :size='32'
                                    :stroke='1'
                                    class='cursor-pointer'
                                    @click='setStatus(ch, false)'
                                />
                                <IconEyeOff
                                    v-else
                                    v-tooltip='"Enable"'
                                    :size='32'
                                    :stroke='1'
                                    class='cursor-pointer'
                                    @click='setStatus(ch, true)'
                                />
                                <span
                                    v-tooltip='"Show Details"'
                                    class='mx-2 cursor-pointer'
                                    @click='shown[ch.name] = !shown[ch.name]'
                                    v-text='ch.name'
                                />

                                <div class='ms-auto'>
                                    <IconLocation
                                        v-if='ch.direction.length === 2'
                                        v-tooltip='"Bi-Directional"'
                                        :size='32'
                                        :stroke='1'
                                    />
                                    <IconLocation
                                        v-else-if='ch.direction.includes("IN")'
                                        v-tooltip='"Location Sharing"'
                                        :size='32'
                                        :stroke='1'
                                    />
                                    <IconLocationOff
                                        v-else-if='ch.direction.includes("OUT")'
                                        v-tooltip='"No Location Sharing"'
                                        :size='32'
                                        :stroke='1'
                                    />
                                </div>
                            </div>
                            <div
                                v-if='shown[ch.name]'
                                class='col-12 pb-2 user-select-none'
                                style='margin-left: 40px;'
                            >
                                <span v-text='ch.description || "No Description"' />
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
import NoChannelsInfo from '../util/NoChannelsInfo.vue';
import {
    IconLocation,
    IconLocationOff,
    IconRefresh,
    IconSearch,
    IconEye,
    IconEyeOff,
} from '@tabler/icons-vue';
import { mapState, mapActions, mapGetters } from 'pinia'
import { useProfileStore } from '/src/stores/profile.ts';
const profileStore = useProfileStore();
import { useCOTStore } from '/src/stores/cots.ts';
const cotStore = useCOTStore();

export default {
    name: 'CloudTAKChannels',
    data: function() {
        return {
            err: false,
            loading: true,
            shown: {},
            paging: {
                filter: ''
            },
        }
    },
    mounted: async function() {
        await this.refresh();
    },
    computed: {
        ...mapState(useProfileStore, ['channels']),
        ...mapGetters(useProfileStore, ['hasNoChannels']),
        processChannels: function() {
            const channels = {};

            JSON.parse(JSON.stringify(profileStore.channels))
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
                if (!key.toLowerCase().includes(this.paging.filter.toLowerCase())) {
                    delete channels[key];
                }
            }

            return channels;
        }
    },
    methods: {
        ...mapActions(useProfileStore, ['loadChannels']),
        refresh: async function() {
            this.loading = true;
            this.loadChannels()
            this.loading = false;
        },
        setStatus: async function(channel, active=false) {
            profileStore.channels = profileStore.channels.map((ch) => {
                if (ch.name === channel.name) ch.active = active;
                return ch;
            });

            await cotStore.clear({
                ignoreArchived: true,
                skipNetwork: false
            })

            const url = stdurl('/api/marti/group');
            await std(url, {
                method: 'PUT',
                body: profileStore.channels
            });
        },
    },
    components: {
        IconEye,
        IconEyeOff,
        IconSearch,
        IconLocation,
        IconLocationOff,
        NoChannelsInfo,
        IconRefresh,
        TablerNone,
        TablerInput,
        TablerLoading,
        MenuTemplate
    }
}
</script>
