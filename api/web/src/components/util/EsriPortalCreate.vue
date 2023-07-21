<template>
    <TablerModal>
        <button type="button" class="btn-close" @click='close' aria-label="Close"></button>
        <div class="modal-status bg-yellow"></div>
        <div class='modal-header'>
            <div class='modal-title'>Create Feature Service</div>
        </div>
        <div class="modal-body row">
            <div class='col-12'>
                <TablerInput
                    label='Service Name'
                    v-model='data.name'
                    v-on:keyup.enter='create'
                />
            </div>
            <div class="col-12 mt-3">
                <div class="col"><a @click='create' class="cursor-pointer btn w-100">Create</a></div>
            </div>
        </div>
    </TablerModal>
</template>

<script>
import {
    TablerModal,
    TablerInput,
} from '@tak-ps/vue-tabler';

export default {
    name: 'EsriPortalCreate',
    props: {
        token: {
            type: String,
            required: true
        },
        portal: {
            type: String,
            required: true
        }
    },
    data: function() {
        return {
            data: {
                name: ''
            }
        }
    },
    methods: {
        create: async function() {
            this.$emit('create', {
                ...this.data
            });
            this.$emit('close');
        },
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
