<template>
    <TablerModal>
        <button type="button" class="btn-close" @click='$emit("close")' aria-label="Close"></button>
        <div class="modal-status bg-yellow"></div>
        <div class="modal-header">
            <span class='modal-title'>Row Editor</span>
            <TablerDelete displaytype='icon' @delete='$emit("remove")'/>
        </div>
        <div v-if='!loading' class="modal-body py-4">
            <TablerSchema
                :schema='schema'
                :disabled='disabled'
                v-model='row'
            />

            <button v-if='!disabled' @click='$emit("done", this.row)' class='btn btn-primary w-100 mt-4'>Done</button>
        </div>
    </TablerModal>
</template>

<script>
import {
    TablerModal,
    TablerSchema,
    TablerDelete
} from '@tak-ps/vue-tabler';

export default {
    name: 'LayerEnvironmentModal',
    props: {
        edit: {
            type: Object,
            required: true
        },
        disabled: {
            type: Boolean,
            default: true
        },
        schema: {
            type: Object,
            required: true
        },
    },
    data: function() {
        return {
            loading: true,
            row: {}
        }
    },
    mounted: function() {
        this.row = Object.assign(this.row, JSON.parse(JSON.stringify(this.edit)));
        this.loading = false;
    },
    components: {
        TablerModal,
        TablerDelete,
        TablerSchema
    }
}
</script>
