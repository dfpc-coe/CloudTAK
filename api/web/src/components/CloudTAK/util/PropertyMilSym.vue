<template>
    <div class='col-12 py-2'>
        <div class='col-12'>
            <IconBadges
                :size='18'
                stroke='1'
                color='#6b7990'
                class='ms-2 me-1'
            />
            <label
                class='subheader user-select-none'
                v-text='props.label'
            />
        </div>
        <div class='px-2'>
            <div class='col-12 bg-accent rounded-bottom px-1 py-1'>
                <label class='subheader mx-2 user-select-none'>Status</label>
                <TablerEnum
                    v-model='breakdown.status'
                    :disabled='true'
                    :options='status'
                />
            </div>
        </div>
    </div>
    <div class='pb-2 col-12' />
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import {
    IconBadges
} from '@tabler/icons-vue';
import {
    TablerEnum
} from '@tak-ps/vue-tabler';

/*
const emit = defineEmits([
    'update:modelValue'
]);
*/

const props = defineProps({
    label: {
        type: String,
        default: 'Unit Information'
    },
    modelValue: {
        type: String,
        required: true,
        description: 'SIDC'
    },
});

const status = ['Present', 'Planned', 'Fully Capable', 'Damaged', 'Destroyed', 'Full to Capacity'];

const breakdown = ref({
    status: status[Number(props.modelValue[6])]
})

</script>
