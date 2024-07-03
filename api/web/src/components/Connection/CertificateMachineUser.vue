<template>
<div class='card mx-2 px-0'>
    <div class='card-body'>
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
            <TablerNone v-else-if='channels.length === 0' :compact='true' :create='false' label='Channels'/>
            <template v-else v-for='channel in channels'>
                <div
                    @click='
                        body.channels.includes(channel.name)
                            ? body.channels.splice(body.channels.indexOf(channel.name), 1)
                            : body.channels.push(channel.name)
                    '
                    class='hover-light px-2 py-2 cursor-pointer row'
                >
                    <div class='col-md-4'>
                        <IconCheck v-if='body.channels.includes(channel.name)' :size='20' :stroke='1' class='me-2 text-green'/>
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
    IconCheck
} from '@tabler/icons-vue';

export default {
    name: 'CertificateMachineUser',
    components: {
        IconCheck,
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
            body: {
                channels: [],
            }
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
    mounted: async function() {
        await this.listChannels();
    },
    methods: {
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
