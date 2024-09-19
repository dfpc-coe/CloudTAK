<template>
    <MenuTemplate name='Overlay Explorer'>
        <div class='row g-0 py-2'>
            <div class='col-12 px-2'>
                <button
                    class='btn btn-primary w-100'
                    @click='$router.push("/menu/files")'
                >
                    <IconUser
                        :size='32'
                        :stroke='1'
                    />Your Files
                </button>
            </div>
        </div>

        <TablerLoading v-if='loading' />
        <template v-else>
            <TablerNone
                v-if='!list.total'
                label='Server Overlays'
                :create='false'
            />
            <template v-else>
                <div
                    v-for='a in list.items'
                    :key='a.id'
                    class='cursor-pointer col-12 py-2 px-3 hover-dark'
                >
                    <div class='col-12 py-2 px-2 d-flex align-items-center'>
                        <span
                            class='mx-2 cursor-pointer'
                            v-text='a.name'
                        />
                    </div>
                </div>
            </template>
        </template>
    </MenuTemplate>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconUser,
} from '@tabler/icons-vue'

export default {
    name: 'OverlayExplorer',
    components: {
        IconUser,
        TablerNone,
        TablerLoading,
        MenuTemplate
    },
    mounted: async function() {
        await this.fetchList();
    },
    watch: {
        paging: {
            deep: true,
            handler: async function() {
                await this.fetchList();
            },
        }
    },
    data: function() {
        return {
            loading: false,
            paging: {
                filter: '',
                limit: 30,
                page: 0
            },
            list: {
                total: 0,
                items: []
            }
        }
    },
    methods: {
        fetchList: async function() {
            this.loading = true;
            const url = stdurl('/api/overlay');
            if (this.paging.filter) url.searchParams.append('filter', this.paging.filter);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('page', this.paging.page);
            this.list = await std(url);
            this.loading = false;
        }
    }
}
</script>
