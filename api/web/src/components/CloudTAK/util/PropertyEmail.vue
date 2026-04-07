<template>
    <div class='col-12 pb-2'>
        <SlideDownHeader
            v-model='expanded'
            label='Email'
        >
            <template #icon>
                <IconMail
                    :size='18'
                    stroke='1'
                    color='#6b7990'
                    class='ms-2 me-1'
                />
            </template>

            <div class='mx-2 pt-2'>
                <CopyField :model-value='props.email'>
                    <a
                        :href='`mailto:${props.email}`'
                        class='cursor-pointer pe-2'
                    >
                        <IconMail
                            :size='24'
                            stroke='1'
                        />
                    </a>
                </CopyField>
            </div>
        </SlideDownHeader>
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import CopyField from './CopyField.vue';
import SlideDownHeader from './SlideDownHeader.vue';
import {
    IconMail
} from '@tabler/icons-vue';

const props = defineProps<{
    email: string;
}>();

const expanded = ref(false);
</script>
