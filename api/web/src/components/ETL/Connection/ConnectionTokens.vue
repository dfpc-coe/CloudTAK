<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                API Tokens
            </h3>

            <div class='ms-auto btn-list'>
                <TablerIconButton
                    title='New Token'
                    @click='token = true'
                >
                    <IconPlus
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerRefreshButton
                    title='Refresh'
                    :loading='loading'
                    @click='fetch'
                />
            </div>
        </div>

        <div style='min-height: 20vh; margin-bottom: 60px'>
            <div class='col-12 px-2 py-2'>
                <TablerInput
                    v-model='paging.filter'
                    icon='search'
                    placeholder='Filter'
                />
            </div>

            <TablerLoading v-if='loading' />
            <TablerNone
                v-else-if='!list.items.length'
                :create='false'
                label='Tokens'
            />
            <div
                v-else
                class='table-responsive'
            >
                <table class='table table-hover card-table table-vcenter cursor-pointer'>
                    <thead>
                        <tr>
                            <th>Token Name</th>
                            <th>Created</th>
                            <th>Updated</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for='t in list.items'
                            :key='t.id'
                            @click='token = t'
                        >
                            <td v-text='t.name' />
                            <td><TablerEpoch :date='+new Date(t.created)' /></td>
                            <td><TablerEpoch :date='+new Date(t.updated)' /></td>
                        </tr>
                    </tbody>
                </table>
            </div>
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

        <TokenModal
            v-if='token'
            :token='token'
            @close='token = undefined'
            @refresh='fetch'
        />
    </div>
</template>

<script setup lang='ts'>
import { ref, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { std, stdurl } from '../../../std.ts';
import type { ETLConnectionTokenList, ETLConnectionToken } from '../../../types.ts';
import TokenModal from './TokenModal.vue';
import TableFooter from '../../util/TableFooter.vue';
import {
    IconPlus,
} from '@tabler/icons-vue';
import {
    TablerInput,
    TablerEpoch,
    TablerLoading,
    TablerIconButton,
    TablerRefreshButton,
    TablerNone,
} from '@tak-ps/vue-tabler';

const route = useRoute();

const loading = ref(true);
const token = ref<ETLConnectionToken | true | undefined>();
const error = ref<Error | undefined>();
const paging = ref({
    filter: '',
    limit: 10,
    page: 0
});

const list = ref<ETLConnectionTokenList> ({
    total: 0,
    items: []
});

watch(paging.value, async () => {
    await fetch();
});

onMounted(async () => {
    await fetch();
});

async function fetch() {
    token.value = undefined;
    error.value = undefined;
    loading.value = true;

    try {
        const url = stdurl(`/api/connection/${route.params.connectionid}/token`);
        url.searchParams.append('limit', String(paging.value.limit));
        url.searchParams.append('page', String(paging.value.page));
        url.searchParams.append('filter', paging.value.filter);
        list.value = await std(url) as ETLConnectionTokenList;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        loading.value = false;
    }
}
</script>
