<template>
    <div class='card-footer py-2'>
        <div class='d-flex align-items-center justify-content-between flex-wrap gap-2'>
            <p
                v-if='total === 0'
                class='m-0 text-muted small'
            >
                No entries
            </p>
            <p
                v-else
                class='m-0 text-muted small'
            >
                <span v-text='limit * currentPage + 1' />–<span v-text='total < limit ? total : (currentPage * limit + limit > total ? total : currentPage * limit + limit)' />
                <span class='d-none d-sm-inline'> of </span>
                <span class='d-sm-none'>/</span>
                <span v-text='total' />
            </p>
            <TablerPager
                v-if='total > limit'
                :page='currentPage'
                :total='total'
                :limit='limit'
                @page='onPage'
            />
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch } from 'vue';
import {
    TablerPager
} from '@tak-ps/vue-tabler';

const props = defineProps<{
    limit: number;
    total: number;
    page?: number;
}>();

const emit = defineEmits<{
    (e: 'page', page: number): void;
}>();

const currentPage = ref<number>(props.page ?? 0);

watch(() => props.page, (val) => {
    if (val !== undefined && val !== currentPage.value) {
        currentPage.value = val;
    }
});

function onPage(p: number): void {
    currentPage.value = p;
    emit('page', p);
}
</script>
