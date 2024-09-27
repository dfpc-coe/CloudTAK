<template>
<div class='col-12'>
    <div
        v-if='!loading'
        class='col-12 px-2 pb-2 pt-2'
    >
        <TablerInput
            v-model='paging.filter'
            icon='search'
            placeholder='Filter'
        />
    </div>

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
                            v-tooltip='"User has Channel Enabled"'
                            :size='32'
                            :stroke='1'
                        />
                        <IconEyeOff
                            v-else
                            v-tooltip='"User has Channel Disabled"'
                            :size='32'
                            :stroke='1'
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
</div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerNone,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
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
import { useCOTStore } from '/src/stores/cots.ts';
const cotStore = useCOTStore();

export default {
    name: 'CloudTAKSubscriptions',
    data: function() {
        return {
            err: false,
            loading: true,
            shown: {},
            channels: [],
            paging: {
                filter: ''
            },
        }
    },
    props: {
        uid: {
            type: String,
            required: true
        }
    },
    mounted: async function() {
        await this.refresh();
    },
    computed: {
        processChannels: function() {
            const channels = {};

            JSON.parse(JSON.stringify(this.channels))
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
        refresh: async function() {
            this.loading = true;
            await this.fetchSubscriptions()
            this.loading = false;
        },
        fetchSubscriptions: async function() {
            const url = stdurl(`/api/marti/subscription/${this.uid}`);
            const subs = await std(url, { method: 'GET' });
            this.channels = subs.groups;
        },
    },
    components: {
        IconEye,
        IconEyeOff,
        IconSearch,
        IconLocation,
        IconLocationOff,
        IconRefresh,
        TablerNone,
        TablerInput,
        TablerLoading,
    }
}
</script>
