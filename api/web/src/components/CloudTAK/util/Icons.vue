<template>
    <div>
        <div class='card-body'>
            <div class='col-12 px-2 pt-2'>
                <TablerInput
                    v-model='paging.filter'
                    placeholder='Filter'
                />
            </div>

            <TablerLoading
                v-if='loading'
                desc='Loading Icons'
            />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <TablerNone
                v-else-if='!list.items.length'
                label='Icons'
                :create='false'
            />
            <template v-else>
                <div class='row g-1 pt-2'>
                    <div
                        v-for='icon in list.items'
                        :key='icon.name'
                        class='col-sm-2'
                        @click='router.push(`/menu/iconset/${icon.iconset}/${icon.id}`)'
                    >
                        <div class='card card-sm hover cursor-pointer'>
                            <div class='col-12'>
                                <div
                                    class='d-flex justify-content-center mt-3'
                                    :class='{
                                        "mt-3": labels,
                                        "my-3": !labels
                                    }'
                                >
                                    <img
                                        :src='icon.data'
                                        height='32'
                                        width='32'
                                    >
                                </div>
                            </div>
                            <div
                                v-if='labels'
                                class='card-body'
                            >
                                <div class='row'>
                                    <div
                                        class='d-inline-block text-truncate'
                                        v-text='icon.name'
                                    />
                                    <div
                                        class='d-inline-block text-truncate text-muted'
                                        v-text='icon.type2525b || "None"'
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class='col-lg-12 d-flex my-4'>
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
                </div>
            </template>
        </div>
    </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { std, stdurl } from '../../../std.ts';
import {
    TablerNone,
    TablerPager,
    TablerInput,
    TablerAlert,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
} from '@tabler/icons-vue'

const props = defineProps({
    iconset: {
        type: String,
        default: undefined
    },
    labels: {
        type: Boolean,
        default: true
    }
});

const router = useRouter();
const error = ref();
const loading = ref(true);

const paging = ref({
    filter: '',
    limit: 100 - 4, // keeps the icon in an even grid
    page: 0
});

const list = ref({
    total: 0,
    items: []
});

watch(paging.value, async () => {
    await fetchList();
});

onMounted(async () => {
    await fetchList();
});

async function fetchList() {
    loading.value = true;

    try {
        const url = stdurl('/api/icon');
        url.searchParams.append('filter', paging.value.filter);
        url.searchParams.append('limit', paging.value.limit);
        url.searchParams.append('page', paging.value.page);
        if (props.iconset) url.searchParams.append('iconset', props.iconset);
        list.value = await std(url);
        loading.value = false;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
        loading.value = false;
    }
}
</script>
