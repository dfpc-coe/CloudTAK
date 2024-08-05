<template>
    <div class='col-12'>
        <label class='subheader mx-2'>Attachments</label>

        <div class='mx-2'>
            <TablerLoading v-if='loading' :inline='true'/>
            <template v-else>
                <template v-for='file of files'>
                    <div class='col-12 hover-button px-2 py-2 d-flex align-items-center'>
                        <IconPhoto v-if='[".png", ".jpg"].includes(file.ext)' :size='24' :stroke='1'/>
                        <IconFile v-else :size='24' :stroke='1'/>
                        <span class='mx-2' v-text='file.name'/>

                        <div class='ms-auto'>
                            <IconDownload
                                v-tooltip='"Download Asset"'
                                :size='24'
                                :stroke='1'
                                class='cursor-pointer'
                                @click='downloadAsset(file)'
                            />
                        </div>
                    </div>
                </template>
            </template>
        </div>
    </div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    IconFile,
    IconPhoto,
    IconDownload
} from '@tabler/icons-vue';

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
        IconPhoto,
        IconFile,
        IconDownload,
        TablerLoading
    },
    mounted: async function() {
        await this.fetchMetadata();
        this.loading = false;
    },
    data: function() {
        return {
            loading: true,
            files: []
        }
    },
    methods: {
        downloadAsset: async function(file) {
            const url = stdurl(`/api/attachment/${file.hash}`);
            url.searchParams.append('token', localStorage.token);
            window.open(url, "_blank")
        },
        fetchMetadata: async function() {
            const url = stdurl(`/api/attachment`);
            for (const a of this.attachments) {
                url.searchParams.append('hash', a);
            }
            this.files = (await std(url)).items;
        }
    }
}
</script>
