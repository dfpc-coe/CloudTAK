<template>
    <div class='col-12 pt-2'>
        <div
            class='d-flex align-items-center cursor-pointer user-select-none py-2 px-2 rounded transition-all mx-2'
            :class='{ "bg-accent": expanded, "hover": !expanded }'
            @click='expanded = !expanded'
        >
            <IconDatabase
                :size='18'
                stroke='1'
                color='#6b7990'
                class='ms-2 me-1'
            />
            <label class='subheader cursor-pointer m-0'>Metadata</label>
            <div class='ms-auto d-flex align-items-center'>
                <IconChevronDown
                    class='transition-transform'
                    :class='{ "rotate-180": !expanded }'
                    :size='18'
                />
            </div>
        </div>

        <div
            class='grid-transition'
            :class='{ expanded: expanded }'
        >
            <div class='overflow-hidden'>
                <div class='table-responsive rounded mx-2 py-2 px-2'>
                    <table class='table card-table table-hover table-vcenter datatable'>
                        <thead>
                            <tr>
                                <th>Key</th>
                                <th>Value</th>
                            </tr>
                        </thead>
                        <tbody class='bg-accent'>
                            <tr
                                v-for='prop of Object.keys(cot.properties.takv)'
                                :key='prop'
                            >
                                <td v-text='prop' />
                                <!-- @vue-expect-error Not a KeyOf -->
                                <td v-text='cot.properties.takv[prop]' />
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import { IconDatabase, IconChevronDown } from '@tabler/icons-vue';
import type COT from '../../../base/cot';

defineProps<{
    cot: COT
}>();

const expanded = ref(false);
</script>

<style scoped>
.grid-transition {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.3s ease-out;
}

.grid-transition.expanded {
    grid-template-rows: 1fr;
}

.rotate-180 {
    transform: rotate(-90deg);
}

.transition-transform {
    transition: transform 0.3s ease-out;
}
</style>
