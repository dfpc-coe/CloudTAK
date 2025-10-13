<template>
    <div class='col-12 d-flex align-items-center py-2 px-2 text-muted'>
        <IconInfoSquareRounded
            :size='32'
            stroke='1'
            class='mx-2'
        />
        <div>
            <span v-text='props.label' /> are only shown if the channel in which they belong is turned on
        </div>
    </div>
</template>

<script setup lang='ts'>
import {
    IconInfoSquareRounded
} from '@tabler/icons-vue';

const props = defineProps({
    label: {
        type: String,
        default: 'Data Syncs'
    }
});
</script>
