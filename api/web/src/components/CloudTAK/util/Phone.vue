<template>
    <div class='col-12'>
        <label class='subheader mx-2'>Phone</label>
        <div class='mx-2'>
            <CopyField
                :text='format(phone)'
                :size='24'
            >
                <a
                    :href='`tel:${format(phone)}`'
                    class='cursor-pointer pe-2'
                >
                    <IconPhone
                        :size='24'
                        :stroke='1'
                    />
                </a>
            </CopyField>
        </div>
    </div>
</template>

<script>
import CopyField from './CopyField.vue';
import phoneFormat from 'phone';
import {
    IconPhone
} from '@tabler/icons-vue';

export default {
    name: 'COTPhone',
    components: {
        CopyField,
        IconPhone
    },
    props: {
        phone: {
            type: String,
            required: true
        },
        unit: {
            type: String,
            default: 'deg'
        }
    },
    methods: {
        format: function(number) {
            const p = phoneFormat(number);

            if (!p.isValid) return number;

            if (p.countryCode === '+1') {
                return `${p.phoneNumber.slice(0, 2)} (${p.phoneNumber.slice(2, 5)}) ${p.phoneNumber.slice(5, 8)}-${p.phoneNumber.slice(8, 12)}`;
            } else {
                return p;
            }
        },
    },
}
</script>
