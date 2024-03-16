<template>
<div>
    <div class='col-12 border-bottom border-light'>
        <div class='modal-header px-0 mx-2'>
            <IconCircleArrowLeft @click='$router.back()' size='32' class='cursor-pointer'/>
            <div class='modal-title'>Data Imports</div>
            <div class='btn-list'>
                <IconRefresh v-if='!loading' @click='fetchList' size='32' class='cursor-pointer' v-tooltip='"Refresh"'/>
            </div>
        </div>
    </div>
    <TablerLoading v-if='loading'/>
    <TablerNone v-else-if='!list.items.length' label='Imports' :create='false'/>
    <template v-else>
        <div @click='$router.push(`/import/${imported.id}`)' :key='imported.id' v-for='imported in list.items'>
            <div class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
                <div class='col-auto'>
                    <Status :status='imported.status'/>
                </div>
                <div class='mx-2 col-auto row'>
                    <div style='width: 300px;' class='text-truncate' v-text='imported.name'></div>
                    <div class='col-12 subheader' v-text='timeDiff(imported.created)'></div>
                </div>
            </div>
        </div>
    </template>
    <TablerPager v-if='list.total > paging.limit' @page='paging.page = $event' :page='paging.page'  :total='list.total' :limit='paging.limit'/>
</div>
</template>

<script>
import {
    TablerNone,
    TablerPager,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconRefresh,
    IconCircleFilled,
    IconCircleArrowLeft
} from '@tabler/icons-vue';
import Status from '../../util/Status.vue';
import timeDiff from '../../../timediff.js';

export default {
    name: 'Imports',
    data: function() {
        return {
            err: false,
            loading: true,
            paging: {
                limit: 20,
                page: 0
            },
            list: []
        }
    },
    watch: {
        paging: {
            deep: true,
            handler: async function() {
                await this.fetchList()
            }
        }
    },
    mounted: async function() {
        await this.fetchList();
    },
    methods: {
        timeDiff(update) {
            return timeDiff(update)
        },
        fetchList: async function() {
            this.loading = true;
            const url = window.stdurl('/api/import');
            url.searchParams.append('order', 'desc');
            url.searchParams.append('page', this.paging.page);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('sort', 'created');
            this.list = await window.std(url);
            this.loading = false;
        },
    },
    components: {
        Status,
        TablerNone,
        TablerPager,
        TablerLoading,
        IconRefresh,
        IconCircleFilled,
        IconCircleArrowLeft,
    }
}
</script>
