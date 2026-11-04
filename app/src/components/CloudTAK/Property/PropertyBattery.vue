<template>
    <span
        :title='battery + "% Battery"'
        class='d-flex'
    >
        <IconBattery1
            v-if='battery <= 25'
            :size='size'
            stroke='1'
        />
        <IconBattery2
            v-else-if='battery <= 50'
            :size='size'
            stroke='1'
        />
        <IconBattery3
            v-else-if='battery <= 75'
            :size='size'
            stroke='1'
        />
        <IconBattery4
            v-else-if='battery <= 100'
            :size='size'
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
    },
    size: {
        type: Number,
        default: 32
    }
})
</script>
