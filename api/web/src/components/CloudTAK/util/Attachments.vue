<template>
    <div class='col-12 d-flex align-items-center py2'>
        <label class='subheader mx-2'>Attachments</label>

        <div class='ms-auto me-2'>
            <IconFileUpload
                v-if='!upload'
                v-tooltip='"Add Attachment"'
                :size='24'
                stroke='1'
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
                <div class='row'>
                    <template v-for='file of files'>
                        <div class='col-4 px-2 py-2'>
                            <img
                                v-if='[".png", ".jpg", "jpeg", "webp"].includes(file.ext)'
                                :src='downloadAssetUrl(file)'
                                :size='24'
                                stroke='1'
                            >
                            <IconFile
                                v-else
                                :size='24'
                                stroke='1'
                            />

                            <div class='d-flex align-items-center mt-2'>
                                <span
                                    class='mx-2 text-truncate'
                                    style='max-width: 300px;'
                                    v-text='file.name'
                                />

                                <div class='ms-auto'>
                                    <IconDownload
                                        v-tooltip='"Download Asset"'
                                        :size='24'
                                        stroke='1'
                                        class='cursor-pointer'
                                        @click='downloadAsset(file)'
                                    />
                                </div>
                            </div>
                        </div>
                    </template>
                </div>
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
    IconDownload
} from '@tabler/icons-vue';

import {
    TablerLoading,
    TablerNone
} from '@tak-ps/vue-tabler'

export default {
    name: 'COTAttachments',
    components: {
        Upload,
        IconFile,
        IconDownload,
        IconFileUpload,
        TablerLoading,
        TablerNone
    },
    props: {
        attachments: {
            type: Array,
            required: true
        },
    },
    emits: [
        'attachment'
    ],
    data: function() {
        return {
            upload: false,
            loading: true,
            files: []
        }
    },
    watch: {
        attachments: {
            deep: true,
            handler: async function() {
                await this.refresh();
            }
        }
    },
    mounted: async function() {
        await this.refresh();
    },
    methods: {
        refresh: async function() {
            this.loading = true;
            if (this.attachments.length) {
                await this.fetchMetadata();
            } else {
                this.files = [];
            }

            this.loading = false;
        },
        uploadHeaders: function() {
            return {
                Authorization: `Bearer ${localStorage.token}`
            };
        },
        uploadComplete: function(event) {
            this.upload = false;

            this.$emit("attachment", JSON.parse(event).hash);
        },
        uploadURL: function() {
            return stdurl(`/api/attachment`);
        },
        downloadAssetUrl: function(file) {
            const url = stdurl(`/api/attachment/${file.hash}`);
            url.searchParams.append('token', localStorage.token);
            return url;
        },
        downloadAsset: async function(file) {
            window.open(this.downloadAssetUrl(file), "_blank")
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
