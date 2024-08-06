<template>
    <div class='col-12 d-flex align-items-center'>
        <label class='subheader mx-2'>Attachments</label>

        <div class='ms-auto me-2'>
            <IconFileUpload
                v-if='!upload'
                v-tooltip='"Add Attachment"'
                :size='24'
                :stroke='1'
                class='cursor-pointer'
                @click='upload = true'
            />
        </div>
    </div>
    <div class='col-12'>
        <div class='mx-2'>
            <TablerLoading
                v-if='loading'
                :inline='true'
                class='my-2'
            />
            <div
                v-else-if='upload'
                class='py-2 px-4'
            >
                <Upload
                    :url='uploadURL()'
                    :headers='uploadHeaders()'
                    method='PUT'
                    @cancel='upload = false'
                    @done='uploadComplete($event)'
                />
            </div>

            <TablerNone
                v-else-if='!files.length'
                :compact='true'
                :create='false'
            />
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
import Upload from '../../util/Upload.vue';
import {
    IconFile,
    IconFileUpload,
    IconPhoto,
    IconDownload
} from '@tabler/icons-vue';

import {
    TablerLoading,
    TablerNone
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
        Upload,
        IconPhoto,
        IconFile,
        IconDownload,
        IconFileUpload,
        TablerLoading,
        TablerNone
    },
    mounted: async function() {
        if (this.attachments.length) {
            await this.fetchMetadata();
        }

        this.loading = false;
    },
    data: function() {
        return {
            upload: false,
            loading: true,
            files: []
        }
    },
    methods: {
        uploadHeaders: function() {
            return {
                Authorization: `Bearer ${localStorage.token}`
            };
        },
        uploadComplete: function(event) {
            this.upload = false;

            console.error(event);
        },
        uploadURL: function() {
            return stdurl(`/api/attachment`);
        },
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
