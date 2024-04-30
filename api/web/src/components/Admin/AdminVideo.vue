<template>
<div>
    <div class="card-header">
        <h1 class='card-title'>Video Server <span v-text='video.id'/></h1>

        <div class='ms-auto btn-list'>
            <TablerDelete
                v-if='video.status === "RUNNING" && video.statusDesired === "RUNNING"'
                @delete='fetchDelete'
                displaytype='icon'
                v-tooltip='"Delete Server"'
            />
            <IconRefresh
                @click='fetch'
                v-tooltip='"Refresh"'
                size='32'
                class='cursor-pointer'
            />
        </div>
    </div>
    <div>
        <TablerLoading v-if='loading'/>
        <div v-else class='card-body'>
            <div class='datagrid'>
                <div class='datagrid-item'>
                    <div class='datagrid-title'>Version</div>
                    <div class='datagrid-content subheader' v-text='video.version'/>
                </div>
                <div class='datagrid-item'>
                    <div class='datagrid-title'>Created</div>
                    <div class='datagrid-content subheader' v-text='video.created'/>
                </div>
                <div class='datagrid-item'>
                    <div class='datagrid-title'>Current Status</div>
                    <div class='datagrid-content subheader' v-text='video.status'/>
                </div>
                <div class='datagrid-item'>
                    <div class='datagrid-title'>Desired Status</div>
                    <div class='datagrid-content subheader' v-text='video.statusDesired'/>
                </div>
                <div class='datagrid-item'>
                    <div class='datagrid-title'>Memory</div>
                    <div class='datagrid-content subheader' v-text='video.memory'/>
                </div>
                <div class='datagrid-item'>
                    <div class='datagrid-title'>IP Public</div>
                    <div class='datagrid-content subheader' v-text='video.ipPublic'/>
                </div>
                <div class='datagrid-item'>
                    <div class='datagrid-title'>IP Private</div>
                    <div class='datagrid-content subheader' v-text='video.ipPrivate'/>
                </div>
            </div>
        </div>
    </div>
</div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerNone,
    TablerDelete,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconRefresh,
} from '@tabler/icons-vue'

export default {
    name: 'SingleVideoAdmin',
    data: function() {
        return {
            err: false,
            loading: true,
            video: {}
        }
    },
    mounted: async function() {
        await this.fetch();
    },
    methods: {
        fetchDelete: async function() {
            this.loading = true;
            const url = stdurl(`/api/video/${this.$route.params.video}`);
            this.video = await std(url, {
                method: 'DELETE'
            });

            this.fetch();
        },
        fetch: async function() {
            this.loading = true;
            const url = stdurl(`/api/video/${this.$route.params.video}`);
            this.video = await std(url);
            this.loading = false;
        }
    },
    components: {
        TablerNone,
        TablerDelete,
        IconRefresh,
        TablerLoading,
    }
}
</script>
