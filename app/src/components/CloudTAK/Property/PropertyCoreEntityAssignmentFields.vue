<template>
    <TablerInput
        v-model='model.name'
        label='Name'
        placeholder='Jane Doe'
        class='pb-2'
    />

    <TablerInput
        v-model='model.role'
        label='Role'
        placeholder='IC'
        class='pb-2'
    />

    <TablerInput
        v-model='model.uid'
        label='Username'
        placeholder='Optional - links a CloudTAK Profile'
        class='pb-2'
    />

    <TablerInput
        v-model='model.remarks'
        label='Remarks'
        placeholder='Optional'
    />
</template>

<script setup lang='ts'>
import { TablerInput } from '@tak-ps/vue-tabler';
import type { CoreEntityAssignmentInput } from '../../../types.ts';

const model = defineModel<CoreEntityAssignmentInput>({ required: true });
</script>
