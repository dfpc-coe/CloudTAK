<template>
    <PropertyFactRow
        label='Phone'
        class='py-1'
    >
        <a
            :href='`tel:${props.phone}`'
            class='text-reset d-block text-truncate'
            v-text='phone'
        />
    </PropertyFactRow>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import PropertyFactRow from '../util/PropertyFactRow.vue';
import { phone as phoneFormat } from 'phone';

const props = defineProps<{
    phone: string;
}>();

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
