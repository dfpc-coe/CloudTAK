<template>
    <div class='col-12 pb-2'>
        <SlideDownHeader
            v-model='expanded'
            label='Phone'
        >
            <template #icon>
                <IconPhone
                    :size='18'
                    stroke='1'
                    color='#6b7990'
                    class='ms-2 me-1'
                />
            </template>

            <div class='mx-2 pt-2'>
                <CopyField :model-value='phone'>
                    <a
                        :href='`tel:${props.phone}`'
                        class='cursor-pointer pe-2'
                    >
                        <IconPhone
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
import { computed, ref } from 'vue';
import CopyField from './CopyField.vue';
import SlideDownHeader from './SlideDownHeader.vue';
import { phone as phoneFormat } from 'phone';
import {
    IconPhone
} from '@tabler/icons-vue';

const props = defineProps<{
    phone: string;
}>();

const expanded = ref(false);
const phone = computed(() => format(props.phone));

function format(number: string): string {
    const p = phoneFormat(number);

    if (!p.isValid) return number;

    if (p.countryCode === '+1') {
        return `${p.phoneNumber.slice(0, 2)} (${p.phoneNumber.slice(2, 5)}) ${p.phoneNumber.slice(5, 8)}-${p.phoneNumber.slice(8, 12)}`;
    } else {
        return p.phoneNumber;
    }
}
</script>
