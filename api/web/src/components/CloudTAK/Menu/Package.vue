<template>
<MenuTemplate :name='pkg.Name'>
    <template #buttons>
        <TablerDelete v-if='profile.username === pkg.SubmissionUser' @delete='deleteFile(pkg.Hash)' displaytype='icon'/>
        <a :href='downloadFile()' v-tooltip='"Download Asset"'><IconDownload size='32' class='cursor-pointer'/></a>
    </template>
    <template #default>
        <TablerLoading v-if='loading'/>
        <div v-else class='mx-4 my-4'>
            <div class='datagrid'>
                <div class="datagrid-item">
                    <div class="datagrid-title">Created By</div>
                    <div class="datagrid-content" v-text='pkg.SubmissionUser'></div>
                </div>

                <div class="datagrid-item">
                    <div class="datagrid-title">Created</div>
                    <div class="datagrid-content" v-text='timeDiff(pkg.SubmissionDateTime)'></div>
                </div>
            </div>

            <div class='col-12 py-3'>
                <button @click='createImport' class='btn btn-primary w-100'>
                    <IconFileImport size='20' class='mx-1'/>Import
                </button>
            </div>
        </div>
    </template>
</MenuTemplate>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import timeDiff from '../../../timediff.js';
import {
    TablerDelete,
    TablerLoading,
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    IconDownload,
    IconFileImport
} from '@tabler/icons-vue';
import { mapState } from 'pinia'
import { useProfileStore } from '/src/stores/profile.ts';

export default {
    name: 'CloudTAKPackage',
    data: function() {
        return {
            loading: true,
            pkg: {
                Name: 'Package'
            }
        }
    },
    computed: {
        ...mapState(useProfileStore, ['profile']),
    },
    mounted: async function() {
        await this.fetch();
    },
    methods: {
        timeDiff(update) {
            return timeDiff(update);
        },
        downloadFile: function() {
            const url = stdurl(`/api/marti/api/files/${this.pkg.Hash}`)
            url.searchParams.append('token', localStorage.token);
            url.searchParams.append('name', this.pkg.Name + '.zip');
            return url;
        },
        fetch: async function() {
            this.loading = true;
            const url = stdurl(`/api/marti/package/${this.$route.params.package}`);
            this.pkg = await std(url);
            this.loading = false;
        },
        createImport: async function() {
            this.loading = true;
            const url = stdurl(`/api/import`);
            const imp = await std('/api/import', {
                method: 'POST',
                body: {
                    name: this.pkg.Name,
                    mode: 'Package',
                    mode_id: this.pkg.Name
                }
            });
           
            this.$router.push(`/menu/imports/${imp.id}`)

        },
    },
    components: {
        IconDownload,
        IconFileImport,
        TablerDelete,
        TablerLoading,
        MenuTemplate,
    }
}
</script>
