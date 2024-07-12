<template>
    <MenuTemplate name='Package'>
        <template #buttons>
            <TablerDelete
                v-if='profile.username === pkg.SubmissionUser'
                displaytype='icon'
                @delete='deleteFile(pkg.Hash)'
            />
            <a
                v-if='!loading && !err'
                v-tooltip='"Download Asset"'
                :href='downloadFile()'
            ><IconDownload
                :size='32'
                :stroke='1'
                class='cursor-pointer'
            /></a>
        </template>
        <template #default>
            <TablerLoading v-if='loading' />
            <TablerAlert
                v-else-if='err'
                :err='err'
            />
            <template v-else-if='mode === "share"'>
                <div class='overflow-auto'>
                    <Share
                        :feats='[shareFeat]'
                        @done='mode = "default"'
                        @cancel='mode = "default"'
                    />
                </div>
            </template>
            <template v-else>
                <div
                    class='row g-2 mx-4 my-4'
                >
                    <div class='datagrid'>
                        <div class='datagrid-item'>
                            <div class='datagrid-title'>
                                Name
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='pkg.Name'
                            />
                        </div>
                        <div class='datagrid-item'>
                            <div class='datagrid-title'>
                                Created By
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='pkg.SubmissionUser'
                            />
                        </div>
                        <div class='datagrid-item'>
                            <div class='datagrid-title'>
                                Created
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='timeDiff(pkg.SubmissionDateTime)'
                            />
                        </div>
                    </div>

                    <div class='col-md-6 py-3'>
                        <button
                            class='btn btn-primary w-100'
                            @click='createImport'
                        >
                            <IconFileImport
                                :size='20'
                                :stroke='1'
                                class='me-2'
                            />Import
                        </button>
                    </div>
                    <div class='col-md-6 py-3'>
                        <button
                            class='btn btn-secondary w-100'
                            @click='mode === "share" ? mode = "default" : mode = "share"'
                        >
                            <IconShare2
                                v-tooltip='"Share"'
                                :size='20'
                                :stroke='1'
                                class='me-2'
                            /> Share
                        </button>
                    </div>
                </div>
            </template>
        </template>
    </MenuTemplate>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import Share from '../util/Share.vue';
import timeDiff from '../../../timediff.js';
import {
    TablerAlert,
    TablerDelete,
    TablerLoading,
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    IconShare2,
    IconDownload,
    IconFileImport
} from '@tabler/icons-vue';
import { mapState } from 'pinia'
import { useProfileStore } from '/src/stores/profile.ts';

export default {
    name: 'CloudTAKPackage',
    components: {
        Share,
        IconShare2,
        IconDownload,
        IconFileImport,
        TablerAlert,
        TablerDelete,
        TablerLoading,
        MenuTemplate,
    },
    data: function() {
        return {
            loading: true,
            err: null,
            mode: 'default',
            server: null,
            pkg: {
                Name: 'Package'
            },
        }
    },
    computed: {
        ...mapState(useProfileStore, ['profile']),
        shareFeat: function() {
            return {
                type: 'Feature',
                properties: {
                    type: 'b-f-t-r',
                    how: 'h-e',
                    fileshare: {
                        "filename": this.pkg.Name + '.zip',
                        "senderUrl": `${this.server.api}/Marti/sync/content?hash=${this.pkg.Hash}`,
                        "sizeInBytes": parseInt(this.pkg.Size),
                        "sha256": this.pkg.Hash,
                        "senderUid": `ANDROID-CloudTAK-${this.profile.username}`,
                        "senderCallsign": this.profile.tak_callsign,
                        "name": this.pkg.Name
                    },
                    metadata: {},
                },
                geometry: {
                    type: 'Point',
                    coordinates: [0, 0, 0]
                }
            }
        }
    },
    mounted: async function() {
        await this.getServer();
        await this.fetch();
    },
    methods: {
        timeDiff(update) {
            return timeDiff(update);
        },
        getServer: async function() {
            this.server = await std('/api/server');
        },
        downloadFile: function() {
            const url = stdurl(`/api/marti/api/files/${this.pkg.Hash}`)
            url.searchParams.append('token', localStorage.token);
            url.searchParams.append('name', this.pkg.Name + '.zip');
            return url;
        },
        fetch: async function() {
            try {
                this.loading = true;
                const url = stdurl(`/api/marti/package/${this.$route.params.package}`);
                this.pkg = await std(url);
                this.loading = false;
            } catch (err) {
                this.err = err;
                this.loading = false;
            }

            this.loading = false;
        },
        deleteFile: async function(hash) {
            this.loading = true;
            await std(`/api/marti/package/${hash}`, {
                method: 'DELETE',
            });

            this.$router.push(`/menu/packages`)

        },
        createImport: async function() {
            this.loading = true;
            const imp = await std('/api/import', {
                method: 'POST',
                body: {
                    name: this.pkg.Name,
                    mode: 'Package',
                    mode_id: this.pkg.Hash
                }
            });

            this.$router.push(`/menu/imports/${imp.id}`)
        },
    },
}
</script>
