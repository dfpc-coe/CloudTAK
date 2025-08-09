<template>
    <div class='col-2 border rounded px-2 pt-2 pb-2 mx-2'>
        <div
            class='d-flex justify-content-center user-select-none'
            v-text='props.name'
        />
        <div class='d-flex justify-content-center py-2'>
            <IconX
                v-if='!props.enabled'
                :size='32'
                color='red'
                stroke='3'
            />
            <IconCheck
                v-else
                :size='32'
                color='green'
                stroke='3'
            />
        </div>

        <div
            class='d-flex justify-content-center subheader'
            v-text='props.port'
        />
    </div>
</template>

<script setup lang='ts'>
import {
    IconX,
    IconCheck,
} from '@tabler/icons-vue'

const props = defineProps<{
    name: string,
    enabled: boolean,
    port: string,
}>()
</script>
