<template>
    <div style='overflow: auto;'>
        <div class='page-wrapper'>
            <div class='page-header d-print-none'>
                <div class='container-xl'>
                    <div class='row g-2 align-items-center'>
                        <div class='col d-flex text-white'>
                            <TablerBreadCrumb />

                            <div class='ms-auto'>
                                <div class='btn-list'>
                                    <a
                                        class='cursor-pointer btn btn-primary'
                                        @click='router.push("/connection/new")'
                                    >
                                        New Connection
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class='page-body'>
            <div class='container-xl'>
                <div class='row row-deck row-cards'>
                    <div class='col-lg-12'>
                        <div class='card'>
                            <div class='card-body'>
                                <label class='form-label'>Connection Search</label>
                                <div class='input-icon mb-3'>
                                    <input
                                        v-model='paging.filter'
                                        type='text'
                                        class='form-control'
                                        placeholder='Search…'
                                    >
                                    <span class='input-icon-addon'>
                                        <IconSearch
                                            :size='24'
                                            stroke='1'
                                        />
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <template v-if='loading'>
                        <TablerLoading />
                    </template>
                    <template v-else>
                        <TablerNone
                            v-if='!list.items.length'
                            label='Connections'
                            @create='router.push("/connection/new")'
                        />
                        <template v-else>
                            <div
                                v-for='connection in list.items'
                                :key='connection.id'
                                class='col-lg-12'
                            >
                                <div class='card'>
                                    <ConnectionCard
                                        :connection='connection'
                                        :clickable='true'
                                        :expanded='true'
                                    />
                                </div>
                            </div>

                            <div class='col-lg-12 d-flex'>
                                <div class='ms-auto'>
                                    <TablerPager
                                        v-if='list.total > paging.limit'
                                        :page='paging.page'
                                        :total='list.total'
                                        :limit='paging.limit'
                                        @page='paging.page = $event'
                                    />
                                </div>
                            </div>
                        </template>
                    </template>
                </div>
            </div>
        </div>
        <PageFooter />
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { ETLConnectionList } from '../../types.ts'
import { std, stdurl } from '../../std.ts';
import PageFooter from '../PageFooter.vue';
import ConnectionCard from './ConnectionCard.vue';
import {
    TablerPager,
    TablerBreadCrumb,
    TablerLoading,
    TablerNone,
} from '@tak-ps/vue-tabler';
import {
    IconSearch
} from '@tabler/icons-vue'

const router = useRouter();

const loading = ref(true);
const paging = ref({
    filter: '',
    limit: 10,
    page: 0
});

const list = ref<ETLConnectionList>({
    total: 0,
    status: {
        dead: 0,
        live: 0,
        unknown: 0
    },
    items: []
})

watch(paging.value, async () => {
    await fetchList();
});

onMounted(async () => {
    await fetchList();
});

async function fetchList() {
    loading.value = true;
    const url = stdurl('/api/connection');
    url.searchParams.append('filter', paging.value.filter);
    url.searchParams.append('limit', String(paging.value.limit));
    url.searchParams.append('page', String(paging.value.page));
    list.value = await std(url) as ETLConnectionList;
    loading.value = false;
}
</script>
