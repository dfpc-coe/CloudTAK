<template>
    <Modal>
        <button type="button" class="btn-close" @click='close' aria-label="Close"></button>
            <div class="modal-status bg-yellow"></div>
            <div class="modal-body text-center py-4">
                <AlertCircleIcon/>
                <h3>Website Error</h3>
                <div class="text-muted" v-text='err.message'></div>
            </div>
            <div class="modal-footer">
                <div class="w-100">
                    <div class="row">
                        <div class="col"><a @click='close' class="cursor-pointer btn w-100">OK</a></div>
                    </div>
                </div>
          </div>
    </Modal>
</template>

<script>
import Modal from './util/Modal.vue';
import {
    AlertCircleIcon
} from 'vue-tabler-icons'

export default {
    name: 'Err',
    props: ['err'],
    methods: {
        close: function() {
            this.$emit('close');
        }
    },
    components: {
        Modal,
        AlertCircleIcon
    }
}
</script>
