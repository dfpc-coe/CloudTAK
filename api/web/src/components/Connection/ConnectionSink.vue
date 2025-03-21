<template>
    <div>
        <div class='card-header d-flex'>
            <h2 class='card-title'>
                Outbound Sinks
            </h2>

            <div class='ms-auto btn-list'>
                <div class='dropdown'>
                    <div
                        id='connectionSinkButton'
                        type='button'
                        data-bs-toggle='dropdown'
                        aria-expanded='false'
                    >
                        <IconPlus
                            v-tooltip='"Create Sink"'
                            :size='32'
                            stroke='1'
                            class='cursor-pointer'
                        />
                    </div>
                    <ul
                        class='dropdown-menu'
                        aria-labelledby='connectionSinkButton'
                    >
                        <div
                            class='d-flex mx-2 my-2 cursor-pointer'
                            @click='$router.push(`/connection/${$route.params.connectionid}/sink/new`)'
                        >
                            ArcGIS Server
                        </div>
                    </ul>
                </div>
                <div />
            </div>

            <IconRefresh
                v-tooltip='"Refresh"'
                :size='32'
                stroke='1'
                class='cursor-pointer'
                @click='listSinks'
            />
        </div>

        <div style='min-height: 20vh; margin-bottom: 60px'>
            <TablerAlert
                v-if='err'
                title='ETL Server Error'
                :err='err'
                :compact='true'
            />
            <TablerLoading v-else-if='loading' />
            <TablerNone
                v-else-if='!list.items.length'
                :create='false'
                label='Sinks'
            />
            <div
                v-else
                class='table-resposive'
            >
                <table class='table card-table table-vcenter datatable table-hover'>
                    <thead>
                        <tr>
                            <th>Name</th>
                        </tr>
                    </thead>
                    <tbody class='table-tbody'>
                        <tr
                            v-for='sink of list.items'
                            :key='sink.id'
                            class='cursor-pointer'
                            @click='$router.push(`/connection/${connection.id}/sink/${sink.id}`)'
                        >
                            <td v-text='sink.name' />
                        </tr>
                    </tbody>
                </table>
            </div>
            <div
                class='position-absolute bottom-0 w-100'
                style='height: 60px;'
            >
                <TableFooter
                    :limit='paging.limit'
                    :total='list.total'
                    @page='paging.page = $event'
                />
            </div>
        </div>
    </div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import TableFooter from '../util/TableFooter.vue';
import {
    TablerAlert,
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler'
import {
    IconPlus,
    IconRefresh,
} from '@tabler/icons-vue';

export default {
    name: 'ConnectionSinks',
    components: {
        TablerNone,
        TablerAlert,
        IconPlus,
        IconRefresh,
        TablerLoading,
        TableFooter,
    },
    props: {
        connection: {
            type: Object,
            required: true
        }
    },
    data: function() {
        return {
            loading: true,
            err: null,
            paging: {
                filter: '',
                limit: 10,
                page: 0
            },
            list: {
                total: 0,
                items: []
            },
        }
    },
    watch: {
        paging: {
            deep: true,
            handler: async function() {
                await this.listSinks();
            },
        }
    },
    mounted: async function() {
        await this.listSinks();
    },
    methods: {
        listSinks: async function() {
            this.loading = true;
            try {
                const url = stdurl(`/api/connection/${this.connection.id}/sink`);
                url.searchParams.append('limit', this.paging.limit);
                url.searchParams.append('page', this.paging.page);
                url.searchParams.append('filter', this.paging.filter);
                this.list = await std(url);
            } catch (err) {
                this.err = err;
            }
            this.loading = false;
        }
    }
}
</script>
