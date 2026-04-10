<template>
    <thead>
        <tr>
            <th
                v-for='s in shown'
                :key='s.name'
            >
                <div class='d-flex align-items-center'>
                    <span
                        class='cursor-pointer'
                        @click='updateSort(s.name)'
                        v-text='s.name'
                    />
                    <span
                        v-if='s.name === sort'
                        class='ms-auto'
                    >
                        <IconChevronDown
                            v-if='order === "asc"'
                            :size='16'
                            stroke='1'
                            class='cursor-pointer'
                            @click='updateOrder("desc")'
                        />
                        <IconChevronUp
                            v-else
                            :size='16'
                            stroke='1'
                            class='cursor-pointer'
                            @click='updateOrder("asc")'
                        />
                    </span>

                    <template v-if='shown[shown.length - 1] === s'>
                        <div class='ms-auto'>
                            <TablerDropdown>
                                <IconSettings
                                    :size='16'
                                    stroke='1'
                                    class='mx-2 dropdown-toggle cursor-pointer'
                                />

                                <template #dropdown>
                                    <div
                                        v-for='(h, h_it) of header'
                                        :key='h_it'
                                    >
                                        <label class='form-check subheader mb-1 mx-1'>
                                            <input
                                                class='form-check-input'
                                                type='checkbox'
                                                :checked='h.display'
                                                @change='displayHeader(h_it, $event)'
                                            >
                                            <span
                                                class='form-check-label'
                                                v-text='h.name'
                                            />
                                        </label>
                                    </div>
                                </template>
                            </TablerDropdown>
                        </div>
                    </template>
                </div>
            </th>
        </tr>
    </thead>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import {
    IconChevronUp,
    IconChevronDown,
    IconSettings
} from '@tabler/icons-vue';
import {
    TablerDropdown
} from '@tak-ps/vue-tabler'

interface HeaderItem {
    name: string;
    display: boolean;
}

const props = withDefaults(defineProps<{
    header: HeaderItem[];
    order?: string;
    sort?: string;
}>(), {
    order: 'desc',
    sort: undefined,
});

const emit = defineEmits<{
    (e: 'update:order', order: string): void;
    (e: 'update:sort', sort: string): void;
    (e: 'update:header', header: HeaderItem[]): void;
}>();

const shown = computed(() => {
   return props.header.filter((h) => {
        return h.display;
   });
});

function updateSort(sort: string) {
    emit('update:sort', sort);
}

function updateOrder(order: string) {
    emit('update:order', order);
}

function displayHeader(h_it: number, $event: Event) {
    const header = JSON.parse(JSON.stringify(props.header));
    header[h_it].display = ($event.target as HTMLInputElement).checked;
    emit('update:header', header);
}
</script>
