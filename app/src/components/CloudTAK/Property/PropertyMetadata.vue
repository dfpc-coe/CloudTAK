<template>
    <div class='col-12'>
        <SlideDownHeader
            v-model='expanded'
            label='Device'
        >
            <template #icon>
                <IconDeviceMobile
                    :size='18'
                    stroke='1'
                    color='#6b7990'
                    class='ms-2 me-1'
                />
            </template>

            <div class='rounded mx-2 mt-2 px-2 py-2'>
                <KeyValueRow
                    v-for='entry of entries'
                    :key='entry.name'
                    :name='entry.name'
                    :value='entry.value'
                />
            </div>
        </SlideDownHeader>
    </div>
</template>

<script setup lang='ts'>
/** PropertyMetadata - the TAK client (takv) that reported the CoT */
import { ref, computed } from 'vue';
import { IconDeviceMobile } from '@tabler/icons-vue';
import SlideDownHeader from '../util/SlideDownHeader.vue';
import KeyValueRow from '../util/KeyValueRow.vue';
import type COT from '../../../base/cot';

const props = defineProps<{
    cot: COT
}>();

const expanded = ref(false);

const entries = computed(() => {
    const takv = (props.cot.properties.takv || {}) as Record<string, unknown>;

    return Object.keys(takv).map((name) => {
        return {
            name,
            value: String(takv[name])
        };
    });
});
</script>
