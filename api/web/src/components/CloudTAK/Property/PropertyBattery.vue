<template>
    <span
        v-tooltip='battery + "% Battery"'
        class='d-flex'
        style='margin-right: 10px;'
    >
        <IconBattery1
            v-if='battery <= 25'
            :size='32'
            stroke='1'
        />
        <IconBattery2
            v-else-if='battery <= 50'
            :size='32'
            stroke='1'
        />
        <IconBattery3
            v-else-if='battery <= 75'
            :size='32'
            stroke='1'
        />
        <IconBattery4
            v-else-if='battery <= 100'
            :size='32'
            stroke='1'
        />
    </span>
</template>

<script setup lang='ts'>
import {
    IconBattery1,
    IconBattery2,
    IconBattery3,
    IconBattery4,
} from '@tabler/icons-vue';

defineProps({
    battery: {
        type: Number,
        required: true
    }
})
</script>
