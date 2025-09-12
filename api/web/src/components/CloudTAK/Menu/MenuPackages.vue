<template>
    <MenuTemplate
        name='Data Packages'
        :loading='loading'
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

            <div class='col-12 px-2 py-2'>
                <TablerInput
                    v-model='paging.filter'
                    icon='search'
                    placeholder='Filter'
                />
            </div>

            <ChannelInfo label='Data Packages' />
            <EmptyInfo v-if='mapStore.hasNoChannels' />

            <TablerAlert
                v-if='error'
                title='Packages Error'
                :err='error'
            />
            <TablerNone
                v-else-if='!list.items.length'
                label='Packages'
                :create='false'
            />
            <template v-else>
                <MenuItem
                    v-for='pkg in filteredList'
                    :key='pkg.Hash'
                    :flex='false'
                    @click='router.push(`/menu/packages/${pkg.UID}`)'
                    @keyup.enter='router.push(`/menu/packages/${pkg.UID}`)'
                >
                    <div
                        class='col-12'
                        v-text='pkg.Name'
                    />
                    <div
                        v-if='pkg.Keywords.length > 1'
                        class='col-12 d-flex py-2'
                    >
                        <template
                            v-for='keyword in pkg.Keywords'
                            :key='keyword'
                        >
                            <span
                                v-if='keyword.startsWith("#")'
                                class='me-1 badge badge-outline bg-blue-lt'
                                v-text='keyword'
                            />
                        </template>
                    </div>
                    <div class='col-12 subheader d-flex'>
                        <div v-text='timeDiff(pkg.SubmissionDateTime)' />
                        <div
                            class='ms-auto me-2'
                            v-text='pkg.SubmissionUser'
                        />
                    </div>
                </MenuItem>
            </template>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import type { PackageList } from '../../../../src/types.ts';
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import MenuTemplate from '../util/MenuTemplate.vue';
import MenuItem from '../util/MenuItem.vue';
import { std, stdurl } from '../../../../src/std.ts';

import {
    TablerNone,
    TablerAlert,
    TablerIconButton,
    TablerRefreshButton,
    TablerInput,
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
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

const filteredList = computed(() => {
    return list.value.items.filter((pkg) => {
        return pkg.Name.toLowerCase()
            .includes(paging.value.filter.toLowerCase());
    })
});

async function fetchList() {
    try {
        upload.value = false;
        error.value = undefined;
        loading.value = true;
        const url = stdurl('/api/marti/package');
        list.value = await std(url) as PackageList;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}
</script>
