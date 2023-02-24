<template>
    <TablerModal>
        <button type="button" class="btn-close" @click='close' aria-label="Close"></button>
            <div class="modal-status bg-yellow"></div>
            <div class="modal-body text-center py-4">
                <TablerInput
                    label='CSV'
                    :rows='10'
                    v-model='csv'
                />

                <div class="row mt-3">
                    <div class="col"><a @click='$emit("import", csv)' class="cursor-pointer btn w-100">Import</a></div>
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
    data: function() {
        return {
            csv: ''
        }
    },
    methods: {
        close: function() {
            this.$emit('close');
        },
    },
    components: {
        TablerModal,
        TablerInput
    }
}
</script>
