<template>
    <TablerModal>
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='close'
        />
        <div class='modal-status bg-yellow' />
        <div class='modal-body text-center py-4'>
            <TablerInput
                v-model='csv'
                label='CSV'
                :rows='10'
            />

            <div class='row mt-3'>
                <div class='col'>
                    <a
                        class='cursor-pointer btn w-100'
                        @click='$emit("import", csv)'
                    >Import</a>
                </div>
            </div>
        </div>
    </TablerModal>
</template>

<script>
import {
    TablerModal,
    TablerInput
} from '@tak-ps/vue-tabler';

export default {
    name: 'UploadCSV',
    components: {
        TablerModal,
        TablerInput
    },
    emits: [
        'import',
        'close'
    ],
    data: function() {
        return {
            csv: ''
        }
    },
    methods: {
        close: function() {
            this.$emit('close');
        },
    }
}
</script>
