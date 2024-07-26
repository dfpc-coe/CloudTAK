<template>
<TablerModal>
    <button type="button" class="btn-close" @click='modal = false' aria-label="Close"></button>
    <div class="modal-status bg-red"></div>
    <div class="modal-header text-center py-4">
        Deletion Confirmation
    </div>
    <div class="modal-body text-center py-4">
        Are you sure you wish to perform this deletion?
    </div>
    <div class="modal-footer">
        <div @click='$emit("delete")' class="btn btn-danger">
            <IconTrash :size='32' :stroke='1'/><span class='mx-2' v-text='label'/>
        </div>
    </div>
</TablerModal>
</template>

<script>
import {
    TablerModal
} from '@tak-ps/vue-tabler'
import {
    IconTrash
} from '@tabler/icons-vue';

export default {
    name: 'OverlayDelete',
    props: {
        label: {
            type: String,
            default: 'Delete'
        },
        size: {
            type: Number,
            default: 32
        },
        displaytype: {
            type: String,
            default: 'button' // Or icon
        }
    },
    data: function() {
        return {
            loading: false,
        }
    },
    methods: {
        deleting: function() {
            this.loading = true;
            this.$emit('delete')
        }
    },
    components: {
        IconTrash,
        TablerModal
    }
}
</script>
