<template>
    <TablerModal>
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='$emit("close")'
        />
        <div class='modal-status bg-yellow' />
        <div class='modal-header'>
            <span class='modal-title'>Row Editor</span>
            <TablerDelete
                v-if='!disabled'
                displaytype='icon'
                @delete='$emit("remove")'
            />
        </div>
        <div
            v-if='!loading'
            class='modal-body py-4'
        >
            <TablerSchema
                v-model='row'
                :schema='schema'
                :disabled='disabled'
            />

            <button
                v-if='!disabled'
                class='btn btn-primary w-100 mt-4'
                @click='$emit("done", row)'
            >
                Done
            </button>
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
    components: {
        TablerModal,
        TablerDelete,
        TablerSchema
    },
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
    emits: [
        'close',
        'remove',
        'done'
    ],
    data: function() {
        return {
            loading: true,
            row: {}
        }
    },
    mounted: function() {
        this.row = Object.assign(this.row, JSON.parse(JSON.stringify(this.edit)));
        this.loading = false;
    }
}
</script>
