<template>
    <MenuTemplate
        name='Paging Notifications'
        :loading='loading'
        :none='!paging.items.length'
    >
        <template #buttons>
            <TablerIconButton
                title='New Paging Source'
                @click='source = {}'
            >
                <IconPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <TablerRefreshButton
                :loading='loading'
                @click='fetch'
            />
        </template>
        <template #default>
            <div class='col-12 d-flex flex-column gap-2 py-3'>
                <StandardItem
                    v-for='p in paging.items'
                    :key='p.id'
                    @click='source = p'
                >
                    <div class='d-flex align-items-center px-2 py-2'>
                        <IconBell
                            :size='32'
                            stroke='1'
                        />
                        <div class='ms-2 flex-grow-1'>
                            <div class='fw-bold'>
                                {{ p.value }}
                            </div>
                            <div class='text-muted small text-uppercase'>
                                {{ p.type }}
                            </div>
                        </div>
                        <div class='d-flex gap-1'>
                            <span
                                v-if='p.verified'
                                class='badge bg-success'
                            >Verified</span>
                            <span
                                v-else
                                class='badge bg-warning text-dark'
                            >Unverified</span>
                            <span
                                v-if='p.enabled'
                                class='badge bg-blue'
                            >Enabled</span>
                        </div>
                    </div>
                </StandardItem>
            </div>
        </template>
    </MenuTemplate>

    <PagingModal
        v-if='source !== false'
        :source='source'
        @close='source = false'
        @refresh='fetch'
    />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import MenuTemplate from '../util/MenuTemplate.vue';
import StandardItem from '../util/StandardItem.vue';
import { server } from '../../../std.ts';
import type { ProfilePaging, ProfilePagingList } from '../../../types.ts';
import PagingModal from './Settings/PagingModal.vue';
import {
    TablerIconButton,
    TablerRefreshButton
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconBell,
} from '@tabler/icons-vue';

const loading = ref<boolean>(true);
const source = ref<ProfilePaging | Record<string, never> | false>(false);
const paging = ref<ProfilePagingList>({
    total: 0,
    items: []
});

onMounted(async () => {
    await fetch();
});

async function fetch(): Promise<void> {
    source.value = false;
    loading.value = true;
    const { data, error } = await server.GET('/api/profile/paging', {
        params: { query: { limit: 100, page: 0, order: 'desc', sort: 'created' } }
    });
    if (error) throw new Error(String(error));
    paging.value = data;
    loading.value = false;
}
</script>
