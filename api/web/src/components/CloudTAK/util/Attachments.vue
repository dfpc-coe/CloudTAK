<template>
    <div class='col-12'>
        <label class='subheader mx-2'>Attachments</label>

        <div class='mx-2'>
            <TablerLoading v-if='loading' :inline='true'/>
            <template v-else>
                <template v-for='a of attachments'>
                    <div class='col-12'>
                        <span v-text='a'/>
                    </div>
                </template>
            </template>
        </div>
    </div>
</template>

<script>
import { std } from '/src/std.ts';
import {
    TablerLoading
} from '@tak-ps/vue-tabler'

export default {
    name: 'COTAttachments',
    props: {
        attachments: {
            type: Array,
            required: true
        },
    },
    components: {
        TablerLoading
    },
    mounted: async function() {
        const load = [];
        for (const a of this.attachments) {
            load.push(this.fetchMetadata(a));
        }

        await Promise.all(load);
    },
    data: function() {
        return {
            loading: true,
            files: []
        }
    },
    methods: {
        fetchMetadata: async function(hash) {
            return await std(`/api/marti/api/files/${hash}/metadata`)
        }
    }
}
</script>
