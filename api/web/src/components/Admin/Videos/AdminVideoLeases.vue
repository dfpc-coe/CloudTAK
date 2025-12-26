<template>
    <div>
        <div class='card-header'>
            <h1 class='card-title'>
                Video Lease
            </h1>

            <div class='ms-auto btn-list'>
                <TablerRefreshButton
                    :loading='loading'
                    @click='fetchList'
                />
            </div>
        </div>
        <div style='min-height: 20vh; margin-bottom: 61px'>
            <div class='row g-0 py-2'>
                <div class='col-md-12 px-2'>
                    <TablerInput
                        v-model='paging.filter'
                        icon='search'
                        placeholder='Filter...'
                    />
                </div>
            </div>

            <TablerLoading
                v-if='loading'
                desc='Loading Video Leases'
            />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <TablerNone
                v-else-if='!list.items.length'
                label='No Video Leases'
                :create='false'
            />
            <div
                v-else
                class='table-responsive'
            >
                <table class='table card-table table-hover table-vcenter datatable'>
                    <TableHeader
                        v-model:sort='paging.sort'
                        v-model:order='paging.order'
                        v-model:header='header'
                    />
                    <tbody>
                        <tr
                            v-for='lease in list.items'
                            :key='lease.id'
                            class='cursor-pointer'
                            @click='modal = lease'
                        >
                            <template v-for='h in header'>
                                <template v-if='h.display'>
                                    <td>
                                        <template v-if='h.name === "expiration"'>
                                            <span
                                                v-if='expired(lease.expiration)'
                                                class='badge bg-red text-white'
                                            >Expired</span>
                                            <span
                                                v-else-if='lease.expiration === null'
                                                class='badge bg-blue text-white'
                                            >Permanent</span>
                                            <span
                                                v-else
                                                class='subheader'
                                                v-text='lease.expiration'
                                            />
                                        </template>
                                        <template v-else>
                                            <span v-text='lease[h.name]' />
                                        </template>
                                    </td>
                                </template>
                            </template>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div
                class='position-absolute bottom-0 w-100'
                style='height: 61px;'
            >
                <TableFooter
                    :limit='paging.limit'
                    :total='list.total'
                    @page='paging.page = $event'
                />
            </div>
        </div>
    </div>

    <VideoLeaseModal
        v-if='modal'
        :lease='modal'
        :is-system-admin='true'
        @close='modal = undefined'
        @refresh='fetchList'
    />
</template>

<script setup lang='ts'>
import { ref, watch, onMounted } from 'vue';
import { std, stdurl } from '../../../../src/std.ts';
import type { VideoLease, VideoLeaseList } from '../../../../src/types.ts';
import TableHeader from '../../util/TableHeader.vue';
import TableFooter from '../../util/TableFooter.vue';
import VideoLeaseModal from '../../CloudTAK/Menu/Videos/VideoLeaseModal.vue';
import {
    TablerNone,
    TablerInput,
    TablerAlert,
    TablerLoading,
    TablerRefreshButton
} from '@tak-ps/vue-tabler';

type Header = { name: keyof VideoLease, display: boolean };

const error = ref<Error | undefined>();
const loading = ref(true);
const header = ref<Array<Header>>([]);
const modal = ref<VideoLease | undefined>()
const paging = ref({
    filter: '',
    sort: 'name',
    order: 'asc',
    limit: 100,
    page: 0
});

const list = ref<VideoLeaseList>({
    total: 0,
    items: []
});

watch(paging.value, async () => {
    await fetchList();
});

onMounted(async () => {
    await listLayerSchema();
    await fetchList();
});

async function listLayerSchema() {
    const schema = await std('/api/schema?method=GET&url=/video/lease');

    const defaults: Array<keyof VideoLease> = ['id', 'name', 'username', 'channel', 'path', 'expiration'];
    header.value = defaults.map((h) => {
        return { name: h, display: true };
    });

    // @ts-expect-error Worth trying to type at some point maybe but not now
    header.value.push(...schema.query.properties.sort.enum.map((h) => {
        return {
            name: h,
            display: false
        } as Header
    }).filter((h: Header) => {
        for (const hknown of header.value) {
            if (hknown.name === h.name) return false;
        }
        return true;
    }));
}

function expired(expiration: string | null): boolean {
    if (!expiration) return false;
    return +new Date(expiration) < +new Date();
}

async function fetchList() {
    error.value = undefined;
    modal.value = undefined;
    loading.value = true;

    try {
        const url = stdurl('/api/video/lease');
        url.searchParams.append('impersonate', String(true));
        url.searchParams.append('expired', 'all');
        url.searchParams.append('filter', paging.value.filter);
        url.searchParams.append('limit', String(paging.value.limit));
        url.searchParams.append('sort', paging.value.sort);
        url.searchParams.append('order', paging.value.order);
        url.searchParams.append('page', String(paging.value.page));

        list.value = await std(url) as VideoLeaseList;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}
</script>
