<template>
    <div class='col-12'>
        <label class='subheader mx-2'>Email</label>
        <div class='mx-2'>
            <CopyField
                v-model='email'
                :size='24'
            >
                <a
                    :href='`mailto:${email}`'
                    class='cursor-pointer pe-2'
                >
                    <IconMail
                        :size='24'
                        stroke='1'
                    />
                </a>
            </CopyField>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import CopyField from './CopyField.vue';
import {
    IconMail
} from '@tabler/icons-vue';

const props = defineProps({
    email: {
        type: String,
        required: true
    },
});

const email = ref(props.email);
</script>
