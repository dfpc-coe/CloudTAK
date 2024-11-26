<template>
    <div class='col-12'>
        <label class='subheader mx-2'>Phone</label>
        <div class='mx-2'>
            <CopyField
                v-model='phone'
                :size='24'
            >
                <a
                    :href='`tel:${phone}`'
                    class='cursor-pointer pe-2'
                >
                    <IconPhone
                        :size='24'
                        stroke='1'
                    />
                </a>
            </CopyField>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch } from 'vue';
import CopyField from './CopyField.vue';
import phoneFormat from 'phone';
import {
    IconPhone
} from '@tabler/icons-vue';

const props = defineProps({
    phone: {
        type: String,
        required: true
    },
    unit: {
        type: String,
        default: 'deg'
    }
});

const phone = ref(format(props.phone));

watch(props, () => {
    phone.value = format(props.phone);
})

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
