<template>
    <MenuTemplate
        name='Data Packages'
    >
        <template #buttons>
            <TablerIconButton
                v-if='!loading'
                title='Create Package'
                @click='upload = true'
            >
                <IconPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <TablerRefreshButton
                :loading='loading'
                @click='fetchList'
            />
        </template>
        <template #default>
            <ShareToPackage
                v-if='upload'
                :upload='true'
                @close='upload = false'
            />

            <div class='d-flex flex-column'>
                <div class='d-flex mx-2 pt-2 flex-row gap-2'>
                    <TablerInput
                        v-model='paging.filter'
                        icon='search'
                        placeholder='Filter'
                        class='flex-grow-1'
                    />
                </div>

                <ChannelInfo label='Data Packages' />
                <EmptyInfo v-if='mapStore.hasNoChannels' />

                <TablerLoading
                    v-if='loading'
                    class='my-5'
                />
                <TablerAlert
                    v-else-if='error'
                    title='Packages Error'
                    :err='error'
                />
                <TablerNone
                    v-else-if='!list.items.length'
                    label='Packages'
                    :create='false'
                />
                <div
                    v-else
                    class='d-flex flex-column gap-3 mx-2'
                >
                    <article
                        v-for='pkg in list.items'
                        :key='pkg.uid'
                        class='menu-packages__card text-white d-flex flex-row gap-3 position-relative'
                        role='button'
                        tabindex='0'
                        @click='router.push(`/menu/packages/${pkg.uid}`)'
                        @keyup.enter='router.push(`/menu/packages/${pkg.uid}`)'
                    >
                        <div class='menu-packages__icon-wrapper ms-2 mt-2 d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25'>
                            <IconPackage
                                :size='24'
                                stroke='1'
                            />
                        </div>

                        <div class='flex-grow-1 d-flex flex-column gap-2 py-2'>
                            <div class='d-flex flex-wrap align-items-center gap-2'>
                                <span
                                    class='fw-semibold text-truncate'
                                    style='max-width: calc(100% - 20px)'
                                    v-text='pkg.name'
                                />
                            </div>

                            <Keywords
                                :keywords='pkg.keywords.filter((k) => k && k.trim() !== "missionpackage")'
                            />
                            <div
                                v-if='!pkg.keywords.filter((k) => k && k.trim() !== "missionpackage").length'
                                class='text-secondary small'
                            >
                                No keywords
                            </div>

                            <div class='text-secondary small d-flex flex-wrap align-items-center gap-2'>
                                <div v-text='timeDiff(pkg.created)' />
                                <span class='text-white-50'>•</span>
                                <div v-text='pkg.username' />
                            </div>
                        </div>
                    </article>
                </div>
            </div>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import type { PackageList } from '../../../../src/types.ts';
import { ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import MenuTemplate from '../util/MenuTemplate.vue';
import Keywords from '../util/Keywords.vue';
import { server } from '../../../std.ts';

import {
    TablerNone,
    TablerAlert,
    TablerIconButton,
    TablerRefreshButton,
    TablerLoading,
    TablerInput,
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconPackage,
} from '@tabler/icons-vue';
import timeDiff from '../../../timediff.ts';
import ChannelInfo from '../util/ChannelInfo.vue';
import EmptyInfo from '../util/EmptyInfo.vue';
import ShareToPackage from '../util/ShareToPackage.vue';
import { useMapStore } from '../../../../src/stores/map.ts';

const mapStore = useMapStore();

const router = useRouter();

const error = ref<Error | undefined>();
const loading = ref(true);
const upload = ref(false)

const paging = ref({
    filter: ''
});

const list = ref<PackageList>({
    total: 0,
    items: []
})

onMounted(async () => {
    await fetchList();
});

watch(paging.value, async () => {
    await fetchList();
});

async function fetchList() {
    try {
        upload.value = false;
        error.value = undefined;
        loading.value = true;

        const res = await server.GET('/api/marti/package', {
            params: {
                query: {
                    filter: paging.value.filter,
                }
            }
        });

        if (res.error) {
            loading.value = false;
            error.value = Error(res.error.message);
            return;
        }

        list.value = res.data;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}
</script>

<style scoped>
.menu-packages__icon-wrapper {
    width: 3rem;
    height: 3rem;
    min-width: 3rem;
    min-height: 3rem;
    flex-shrink: 0;
}

.menu-packages__card {
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 14px;
    background-color: rgba(0, 0, 0, 0.35);
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.menu-packages__card:hover,
.menu-packages__card:focus-within {
    transform: translateY(-1px);
    border-color: rgba(255, 255, 255, 0.4);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
}
</style>
