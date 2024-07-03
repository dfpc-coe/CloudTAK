<template>
<div class='card mx-2 px-0'>
    <div class='card-body'>
        <div v-for='(channel, it) in selected' class='card my-2'>
            <div class='col-12 d-flex align-items-center px-2 py-2'>
                <div v-text='channel.name' />
                <div class='ms-auto'>
                    <IconTrash
                        :size='32'
                        :stroke='1'
                        class='cursor-pointer'
                        v-tooltip='"Remove Channel"'
                        @click='selected.splice(it, 1)'
                    />
                </div>
            </div>
        </div>
        <div class='col-12 mb-2'>
            <TablerInput
                v-model='paging.filter'
                label='Channels Filter'
                @keyup.enter='generate'
            />
        </div>
        <div class='col-12'>
            <TablerLoading
                v-if='loading.channels'
                desc='Loading Channels'
            />
            <TablerNone v-else-if='filteredChannels.length === 0' :compact='true' :create='false' label='Channels'/>
            <template v-else v-for='channel in filteredChannels'>
                <div
                    @click='push(channel)'
                    class='hover-light px-2 py-2 cursor-pointer row'
                >
                    <div class='col-md-4'>
                        <span v-text='channel.name'/>
                    </div>

                    <div class='col-md-8' v-text='channel.description'/>
                </div>
            </template>
        </div>
    </div>
    <div class='card-footer'>
        <button class='cursor-pointer btn btn-primary w-100' @click='generate'>Create Machine User</button>
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
    emits: [
        'certs',
    ],
    data: function() {
        return {
            loading: {
                channels: true
            },
            paging: {
                filter: ''
            },
            channels: [],
            selected: []
        }
    },
    watch: {
        paging: {
            deep: true,
            handler: async function() {
                await this.listChannels();
            }
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
    mounted: async function() {
        await this.listChannels();
    },
    methods: {
        push: async function(channel) {
            for (const ch of this.selected) {
                if (ch.id === channel.id) return;
            }
            this.selected.push(channel);
        },
        listChannels: async function() {
            this.loading.channels = true;

            try {
                const url = stdurl('/api/ldap/channel');
                this.channels = (await std(url)).items;
            } catch (err) {
                this.loading.channels = false;
                throw err;
            }
            this.loading.channels = false;
        },
        generate: async function() {

        }
    }
}
</script>
