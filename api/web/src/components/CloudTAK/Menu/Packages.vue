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

            <TablerIconButton
                v-if='!loading'
                title='Refresh'
                @click='fetchList'
            >
                <IconRefresh
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
        </template>
        <template #default>
            <div
                v-if='upload'
                class='px-3 py-4'
            >
                <Upload
                    :url='stdurl("/api/marti/package")'
                    :headers='uploadHeaders()'
                    @cancel='upload = false'
                    @done='fetchList'
                />
            </div>
            <template v-else>
                <div class='col-12 px-2 py-2'>
                    <TablerInput
                        v-model='paging.filter'
                        icon='search'
                        placeholder='Filter'
                    />
                </div>

                <ChannelInfo label='Data Packages' />
                <EmptyInfo v-if='hasNoChannels' />

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
                        @click='$router.push(`/menu/packages/${pkg.UID}`)'
                        @keyup.enter='$router.push(`/menu/packages/${pkg.UID}`)'
                    >
                        <div
                            class='col-12'
                            v-text='pkg.Name'
                        />
                        <div class='col-12 subheader d-flex'>
                            <div v-text='timeDiff(pkg.SubmissionDateTime)' />
                            <div
                                class='ms-auto'
                                v-text='pkg.SubmissionUser'
                            />
                        </div>
                    </MenuItem>
                </template>
            </template>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import type { PackageList } from '../../../../src/types.ts';
import { ref, computed, onMounted } from 'vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import MenuItem from '../util/MenuItem.vue';
import { std, stdurl } from '../../../../src/std.ts';

import {
    TablerNone,
    TablerAlert,
    TablerIconButton,
    TablerInput,
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconRefresh,
} from '@tabler/icons-vue';
import timeDiff from '../../../timediff.ts';
import ChannelInfo from '../util/ChannelInfo.vue';
import EmptyInfo from '../util/EmptyInfo.vue';
import Upload from '../../util/Upload.vue';
import { useProfileStore } from '../../../../src/stores/profile.ts';
const profileStore = useProfileStore();

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

const hasNoChannels = profileStore.hasNoChannels;

const filteredList = computed(() => {
    return list.value.items.filter((pkg) => {
        return pkg.Name.toLowerCase()
            .includes(paging.value.filter.toLowerCase());
    })
});

function uploadHeaders() {
    return {
        Authorization: `Bearer ${localStorage.token}`
    };
}

async function fetchList() {
    try {
        upload.value = false;
        loading.value = true;
        const url = stdurl('/api/marti/package');
        list.value = await std(url) as PackageList;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}
</script>
