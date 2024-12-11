<template>
    <div class='card mx-2 px-0'>
        <div class='card-body'>
            <TablerLoading v-if='loading.gen' />
            <template v-else>
                <div
                    v-for='(channel, it) in selected'
                    class='card my-2'
                >
                    <div class='col-12 d-flex align-items-center px-2 py-2'>
                        <div v-text='channel.rdn' />
                        <div class='ms-auto'>
                            <IconTrash
                                v-tooltip='"Remove Channel"'
                                :size='32'
                                :stroke='1'
                                class='cursor-pointer'
                                @click='selected.splice(it, 1)'
                            />
                        </div>
                    </div>
                </div>
                <div class='col-12 mb-2'>
                    <TablerInput
                        v-model='paging.filter'
                        placeholder='Channels Filter...'
                        @keyup.enter='generate'
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
                            class='hover-light px-2 py-2 cursor-pointer row'
                            @click='push(channel)'
                        >
                            <div class='col-md-4'>
                                <span v-text='channel.rdn' />
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
        <div class='card-footer'>
            <button
                :disabled='loading.gen || !selected.length'
                class='cursor-pointer btn btn-primary w-100'
                @click='generate'
            >
                Create Machine User
            </button>
        </div>
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
    IconTrash
} from '@tabler/icons-vue';

export default {
    name: 'CertificateMachineUser',
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
        'certs', 'integration',
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
            channels: [],
            selected: []
        }
    },
    computed: {
        filteredChannels: function() {
            return this.channels.filter((ch) => {
                for (const sel of this.selected) {
                    if (ch.id === sel.id) return false;
                }

                return true;
            })
        }
    },
    watch: {
        'connection.agency': async function() {
            await this.listChannels();
        },
        paging: {
            deep: true,
            handler: async function() {
                await this.listChannels();
            }
        }
    },
    mounted: async function() {
        await this.listChannels();
    },
    methods: {
        push: async function(channel) {
            this.paging.filter = '';

            for (const ch of this.selected) {
                if (ch.id === channel.id) return;
            }
            this.selected.push(channel);
        },
        listChannels: async function() {
            this.loading.channels = true;

            try {
                const url = stdurl('/api/ldap/channel');
                if (this.connection.agency) {
                    url.searchParams.append('agency', this.connection.agency);
                }
                url.searchParams.append('filter', this.paging.filter);
                this.channels = (await std(url)).items;
            } catch (err) {
                this.loading.channels = false;
                throw err;
            }
            this.loading.channels = false;
        },
        generate: async function() {
            this.loading.gen = true;
            const url = stdurl('/api/ldap/user');
            const res = await std(url, {
                method: 'POST',
                body: {
                    name: this.connection.name,
                    description: this.connection.description,
                    agency_id: this.connection.agency,
                    channels: this.selected.map((s) => { return s.id })
                }
            })

            this.loading.gen = true;
            this.$emit('certs', res.certificate);
            this.$emit('integration', res.integrationId)
        }
    }
}
</script>
