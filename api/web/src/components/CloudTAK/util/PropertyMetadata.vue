<template>
    <div class='col-12 pt-2'>
        <SlideDownHeader
            v-model='expanded'
            label='Metadata'
        >
            <template #icon>
                <IconDatabase
                    :size='18'
                    stroke='1'
                    color='#6b7990'
                    class='ms-2 me-1'
                />
            </template>

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
                            v-for='prop of Object.keys(cot.properties.takv || {})'
                            :key='prop'
                        >
                            <td v-text='prop' />
                            <!-- @vue-expect-error Not a KeyOf -->
                            <td v-text='cot.properties.takv[prop]' />
                        </tr>
                    </tbody>
                </table>
            </div>
        </SlideDownHeader>
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import { IconDatabase } from '@tabler/icons-vue';
import SlideDownHeader from './SlideDownHeader.vue';
import type COT from '../../../base/cot';

defineProps<{
    cot: COT
}>();

const expanded = ref(false);
</script>


