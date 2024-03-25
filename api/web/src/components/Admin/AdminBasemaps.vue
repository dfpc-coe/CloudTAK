<template>
<div>
    <div class="card-header">
        <h1 class='card-title'>Basemaps</h1>

        <div class='ms-auto btn-list'>
            <IconPlus
                @click='$router.push("/basemap/new")'
                v-tooltip='"New Basemap"'
                size='32'
                class='cursor-pointer'
            />
            <IconRefresh
                @click='fetchList'
                v-tooltip='"Refresh"'
                size='32'
                class='cursor-pointer'
            />
        </div>
    </div>
    <template v-if='loading'>
        <div class='card-body'>
            <TablerLoading/>
        </div>
    </template>
    <template v-else>
        <TablerNone
            v-if='!list.items.length'
            label='Basemaps'
            @create='$router.push("/basemap/new")'
        />
        <template v-else>
            <div class='table-responsive'>
                <table class="table card-table table-hover table-vcenter datatable">
                    <TableHeader
                        v-model:sort='paging.sort'
                        v-model:order='paging.order'
                        v-model:header='header'
                    />
                    <tbody>
                        <tr @click='$router.push(`/basemap/${basemap.id}`)' :key='basemap.id' v-for='(basemap, basemap_it) in list.items' class='cursor-pointer'>
                            <template v-for='h in header'>
                                <template v-if='h.display'>
                                    <td>
                                        <span v-text='basemap[h.name]'/>
                                    </td>
                                </template>
                            </template>
                        </tr>
                    </tbody>
                </table>
                <TableFooter
                    :limit='paging.limit'
                    :total='list.total'
                    @page='paging.page = $event'
                />
            </div>
        </template>
    </template>
</div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import TableHeader from '../util/TableHeader.vue'
import TableFooter from '../util/TableFooter.vue'
import {
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconRefresh,
    IconCloudUpload,
} from '@tabler/icons-vue'

export default {
    name: 'LayerAdmin',
    data: function() {
        return {
            err: false,
            loading: true,
            header: [],
            paging: {
                filter: '',
                sort: 'name',
                order: 'asc',
                limit: 100,
                page: 0
            },
            list: {
                total: 0,
                items: []
            }
        }
    },
    watch: {
       paging: {
            deep: true,
            handler: async function() {
                await this.fetchList();
            }
        }
    },
    mounted: async function() {
        await this.listSchema();
        await this.fetchList();
    },
    methods: {
        listSchema: async function() {
            const schema = await std('/api/schema?method=GET&url=/basemap');
            this.header = ['name', 'type'].map((h) => {
                return { name: h, display: true };
            });

            this.header.push(...schema.query.properties.sort.enum.map((h) => {
                return {
                    name: h,
                    display: false
                }
            }).filter((h) => {
                for (const hknown of this.header) {
                    if (hknown.name === h.name) return false;
                }
                return true;
            }));
        },
        fetchList: async function() {
            this.loading = true;
            const url = stdurl('/api/basemap');
            if (this.query && this.paging.filter) url.searchParams.append('filter', this.paging.filter);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('page', this.paging.page);
            this.list = await std(url);
            this.loading = false;
        }
    },
    components: {
        TablerNone,
        IconPlus,
        IconRefresh,
        IconCloudUpload,
        TablerLoading,
        TableHeader,
        TableFooter,
    }
}
</script>
