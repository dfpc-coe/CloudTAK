<template>
    <div>
        <TablerInput
            :model-value='modelValue'
            icon='search'
            :placeholder='placeholder'
            @update:model-value='emit("update:modelValue", $event as string)'
        />
        <div class='d-flex align-items-center justify-content-between mt-1'>
            <TablerDropdown
                v-if='hasFilters'
                position='bottom-start'
            >
                <div class='d-flex align-items-center gap-1 px-1 py-1 rounded cursor-pointer cloudtak-hover'>
                    <IconChevronDown
                        :size='16'
                        stroke='1'
                    />
                    <span class='small text-muted'>Filters</span>
                    <TablerBadge
                        v-if='activeFilters > 0'
                        background-color='var(--tblr-primary)'
                        text-color='#ffffff'
                    >
                        {{ activeFilters }}
                    </TablerBadge>
                </div>
                <template #dropdown>
                    <slot name='filters' />
                </template>
            </TablerDropdown>
            <div v-else />

            <TablerDropdown
                v-if='sortOptions.length'
                position='bottom-end'
            >
                <TablerIconButton title='Sort'>
                    <slot name='sort-icon'>
                        <IconArrowsSort
                            :size='20'
                            stroke='1'
                        />
                    </slot>
                </TablerIconButton>
                <template #dropdown>
                    <div style='min-width: 160px;'>
                        <a
                            v-for='option in sortOptions'
                            :key='option'
                            class='dropdown-item d-flex align-items-center'
                            :class='{ active: sort === option }'
                            href='#'
                            @click.prevent='emit("update:sort", option)'
                            v-text='option'
                        />
                    </div>
                </template>
            </TablerDropdown>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed, useSlots } from 'vue';
import {
    TablerInput,
    TablerBadge,
    TablerDropdown,
    TablerIconButton,
} from '@tak-ps/vue-tabler';
import {
    IconChevronDown,
    IconArrowsSort,
} from '@tabler/icons-vue';

export interface SearchSortFilterProps {
    modelValue: string;
    sort?: string;
    sortOptions?: string[];
    activeFilters?: number;
    placeholder?: string;
}

const props = withDefaults(defineProps<SearchSortFilterProps>(), {
    sort: '',
    sortOptions: () => [],
    activeFilters: 0,
    placeholder: 'Search',
});

const emit = defineEmits<{
    'update:modelValue': [value: string];
    'update:sort': [value: string];
}>();

const slots = useSlots();
const hasFilters = computed(() => !!slots.filters);
</script>
