<template>
<div>
    <div class="card-header">
            <IconCircleArrowLeft
                @click='$router.push("/admin/video")'
                size='32'
                class='cursor-pointer'
            />
        <h1 class='mx-2 card-title d-flex align-items-center'>
            <template v-if='video.status'>
                <Status v-if='video.status === "RUNNING"' status='Success'/>
                <Status v-else :status='video.status'/>
            </template>
            <div class='mx-2'>
                Video Server
                <span v-text='video.id' class='mx-2'/>
            </div>
        </h1>

        <div class='ms-auto btn-list'>
            <TablerDelete
                v-if='!loading && video.status === "RUNNING" && video.statusDesired === "RUNNING"'
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
                    <div class='datagrid-content' v-text='video.version'/>
                </div>
                <div class='datagrid-item'>
                    <div class='datagrid-title'>Created</div>
                    <div class='datagrid-content' v-text='video.created'/>
                </div>
                <div class='datagrid-item'>
                    <div class='datagrid-title'>Desired Status</div>
                    <div class='datagrid-content' v-text='video.statusDesired'/>
                </div>
                <div class='datagrid-item'>
                    <div class='datagrid-title'>Memory</div>
                    <div class='datagrid-content' v-text='video.memory'/>
                </div>
                <div class='datagrid-item'>
                    <div class='datagrid-title'>IP Public</div>
                    <div class='datagrid-content' v-text='video.ipPublic'/>
                </div>
                <div class='datagrid-item'>
                    <div class='datagrid-title'>IP Private</div>
                    <div class='datagrid-content' v-text='video.ipPrivate'/>
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
import Status from '../util/Status.vue';
import {
    IconRefresh,
    IconCircleArrowLeft,
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

            await this.fetch();
         
            this.$router.push("/admin/video");
        },
        fetch: async function() {
            this.loading = true;
            const url = stdurl(`/api/video/${this.$route.params.video}`);
            this.video = await std(url);
            this.loading = false;
        }
    },
    components: {
        Status,
        TablerNone,
        TablerDelete,
        IconRefresh,
        IconCircleArrowLeft,
        TablerLoading,
    }
}
</script>
