<template>
<div class='col-lg-12'>
    <div
        class='alert alert-info d-flex'
        role='alert'
    >
        <div class='alert-icon'>
            <IconInfoCircle
                :size='24'
                stroke='1'
            />
        </div>

        <span v-text='props.description'/>
    </div>
</div>
</template>

<script setup lang='ts'>
import {
    IconInfoCircle
} from '@tabler/icons-vue';

const props = defineProps<{
    description: string;
}>();
</script>
