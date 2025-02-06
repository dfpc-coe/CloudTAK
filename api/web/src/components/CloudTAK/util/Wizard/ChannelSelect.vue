<template>
    <div>
        <div class='d-flex align-items-center'>
            <label class='mx-1 mb-1'>Channel Selection</label>
        </div>
        <div class='card px-0'>
            <div class='card-body'>
                <TablerLoading v-if='loading.gen' />
                <template v-else>
                    <div
                        v-for='(channel, it) in selected'
                        class='card my-2'
                    >
                        <div class='col-12 d-flex align-items-center px-2 py-2'>
                            <div v-text='channel.name' />
                            <div class='ms-auto'>
                                <IconTrash
                                    v-tooltip='"Remove Channel"'
                                    :size='32'
                                    stroke='1'
                                    class='cursor-pointer'
                                    @click='selected.splice(it, 1)'
                                />
                            </div>
                        </div>
                    </div>
                    <div class='col-12 mb-2'>
                        <TablerInput
                            v-if='Object.keys(filteredChannels).length'
                            v-model='paging.filter'
                            placeholder='Channels Filter...'
                        />
                    </div>
                    <div class='col-12'>
                        <TablerLoading
                            v-if='loading.channels'
                            desc='Loading Channels'
                        />
                        <TablerNone
                            v-else-if='filteredChannels.length === 0'
                            :compact='true'
                            :create='false'
                            label='Channels'
                        />
                        <template
                            v-for='channel in filteredChannels'
                            v-else
                        >
                            <div
                                class='hover-dark px-2 py-2 cursor-pointer row'
                                @click='push(channel)'
                            >
                                <div class='col-md-4'>
                                    <span v-text='channel.name' />
                                </div>

                                <div
                                    class='col-md-8'
                                    v-text='channel.description'
                                />
                            </div>
                        </template>
                    </div>
                </template>
            </div>
        </div>
    </div>
</template>

<script>
import { std } from '/src/std.ts';
import {
    TablerNone,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconTrash
} from '@tabler/icons-vue';

export default {
    name: 'ChannelSelect',
    components: {
        IconTrash,
        TablerNone,
        TablerInput,
        TablerLoading
    },
    props: {
        connection: Object
    },
    emits: [
        'update:modelValue'
    ],
    data: function() {
        return {
            loading: {
                gen: false,
                channels: true
            },
            paging: {
                filter: ''
            },
            rawChannels: [],
            selected: []
        }
    },
    computed: {
        filteredChannels: function() {
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

            for (const sel of this.selected) {
                delete channels[sel.name]
            }

            return channels;
        }
    },
    watch: {
        paging: {
            deep: true,
            handler: async function() {
                await this.listChannels();
            }
        },
        selected: {
            deep: true,
            handler: function() {
                this.$emit('update:modelValue', this.selected);
            }
        }
    },
    mounted: async function() {
        await this.listChannels();
    },
    methods: {
        push: async function(channel) {
            this.paging.filter = '';

            for (const sel of this.selected) {
                if (sel.name === channel.name) return;
            }

            this.selected.push(channel);
        },
        listChannels: async function() {
            this.loading.channels = true;

            this.loading = true;
            this.rawChannels = (await std(`/api/connection/${this.connection.id}/channel`)).data;
            this.loading = false;
        },
    }
}
</script>
