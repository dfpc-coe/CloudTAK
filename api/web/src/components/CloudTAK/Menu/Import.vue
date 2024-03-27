<template>
<div>
    <div class='col-12 border-bottom border-light'>
        <div class='modal-header px-0 mx-2'>
            <IconCircleArrowLeft @click='$router.back()' size='32' class='cursor-pointer'/>
            <div class='modal-title d-flex'>
                <Status v-if='!loading.initial' :status='imported.status'/>
                <div class='d-flex align-items-center mx-2'>Import</div>
            </div>
            <div class='btn-list'>
                <IconRefresh @click='fetchList' size='32' class='cursor-pointer' v-tooltip='"Refresh"'/>
            </div>
        </div>
    </div>
    <TablerLoading v-if='loading.initial'/>
    <div v-else class='mx-4 my-4'>
        <div class='datagrid'>
            <div class="datagrid-item">
                <div class="datagrid-title">Import Type</div>
                <div class="datagrid-content" v-text='imported.mode + ": " + imported.mode_id'></div>
            </div>
            <div class="datagrid-item">
                <div class="datagrid-title">Filename</div>
                <div class="datagrid-content" v-text='imported.name'></div>
            </div>
        </div>
        <div class='py-2'>
            <TablerNone v-if='imported.status === "Empty"' :create='false'/>
            <TablerLoading v-else-if='loading.run' desc='Running Import'/>
            <template v-else-if='imported.status === "Fail"'>
                <pre v-text='imported.error'/>
            </template>
        </div>
        <div class='datagrid d-flex'>
            <div class="datagrid-item">
                <div class="datagrid-title">Created</div>
                <div class="datagrid-content" v-text='timeDiff(imported.created)'></div>
            </div>
            <div class="datagrid-item ms-auto">
                <div class="datagrid-title">Updated</div>
                <div class="datagrid-content" v-text='timeDiff(imported.updated)'></div>
            </div>
        </div>
    </div>
</div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import Status from '../../util/Status.vue';
import timeDiff from '../../../timediff.js';
import {
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconRefresh,
    IconCircleArrowLeft
} from '@tabler/icons-vue';

export default {
    name: 'CloudTAKImport',
    data: function() {
        return {
            loading: {
                main: true,
                initial: true,
                run: true
            },
            interval: false,
            imported: {
                id: ''
            }
        }
    },
    mounted: async function() {
        await this.fetch();

        this.interval = setInterval(() => {
            this.fetch()
        }, 1000);
    },
    unmounted: function() {
        if (this.interval) clearInterval(this.interval);
    },
    methods: {
        timeDiff(update) {
            return timeDiff(update);
        },
        fetch: async function() {
            this.loading.main = true;
            const url = stdurl(`/api/import/${this.$route.params.import}`);
            this.imported = await std(url);
            if (this.imported.status === 'Failed' || this.imported.status === 'Success') {
                if (this.interval) clearInterval(this.interval);
                this.loading.run = false;
            }
            this.loading.initial = false;
            this.loading.main = false;
        },
    },
    components: {
        Status,
        IconRefresh,
        IconCircleArrowLeft,
        TablerNone,
        TablerLoading
    }
}
</script>
