<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                User Assets
            </h3>

            <div class='ms-auto btn-list'>
                <IconPlus
                    v-tooltip='"Upload"'
                    :size='32'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='upload = true'
                />
                <IconRefresh
                    v-tooltip='"Refresh"'
                    :size='32'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='fetchList'
                />
            </div>
        </div>

        <div
            v-if='!err && !upload && !loading.list && list.assets.length'
            class='table-responsive'
        >
            <table class='table table-hover table-vcenter card-table'>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Size</th>
                        <th>Updated</th>
                    </tr>
                </thead>
                <tbody>
                </tbody>
            </table>
        </div>
        <div
            v-else
            class='card-body'
        >
            <template v-if='err'>
                <TablerAlert
                    title='Asset Error'
                    :err='err'
                    :compact='true'
                />
            </template>
            <TablerLoading v-else-if='loading.list' />
            <Upload
                v-else-if='upload'
                :url='uploadURL()'
                :headers='uploadHeaders()'
                @cancel='upload = false'
                @done='fetchList'
            />
            <TablerNone
                v-else-if='!list.assets.length'
                :create='false'
                :compact='true'
            />
        </div>

        <TransformModal
            v-if='transform.shown'
            :asset='transform.asset'
            @close='initTransform'
        />
    </div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    IconPlus,
    IconMap,
    IconMapOff,
    IconRefresh,
    IconDownload,
    IconTransform,
} from '@tabler/icons-vue'
import TransformModal from './TransformModal.vue';
import Upload from '../util/Upload.vue';

export default {
    name: 'ProfileFiles',
    components: {
        TablerNone,
        Upload,
        TablerAlert,
        IconPlus,
        IconMap,
        IconMapOff,
        IconRefresh,
        IconTransform,
        IconDownload,
        TablerDelete,
        TablerLoading,
        TablerBytes,
        TablerEpoch,
        TransformModal
    },
    emits: [
        'assets'
    ],
    data: function() {
        return {
            err: null,
            upload: false,
            loading: {
                list: true
            },
            transform: {
                shown: false,
                asset: {}
            },
            list: {
                total: 0,
                assets: []
            }
        };
    },
    mounted: async function() {
        await this.fetchList();
    },
    methods: {
        uploadHeaders: function() {
            return {
                Authorization: `Bearer ${localStorage.token}`
            };
        },
        uploadURL: function() {
            return stdurl(`/api/profile/asset`);
        },
    }
}
</script>
