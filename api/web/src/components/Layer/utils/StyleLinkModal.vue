<template>
    <TablerModal>
        <button type="button" class="btn-close" @click='$emit("close")' aria-label="Close"></button>
        <div class="modal-status bg-yellow"></div>
        <div class="modal-header">
            <span class='modal-title'>Edit Link</span>
        </div>
        <div class="modal-body py-4">
            <TablerInput label='Link URL' v-model='link.url' class='py-1'/>

            <button v-if='edit' @click='done' class='btn btn-primary w-100 mt-4'>Update</button>
            <button v-else @click='done' class='btn btn-primary w-100 mt-4'>Create</button>
        </div>
    </TablerModal>
</template>

<script>

import {
    TablerInput,
    TablerToggle,
    TablerEnum,
    TablerModal,
} from '@tak-ps/vue-tabler';

export default {
    name: 'LayerSchemaModal',
    props: {
        edit: {
            type: Object,
        },
        schema: {
            type: Array,
            required: true
        }
    },
    data: function() {
        return {
            link: {
                url: '',
            }
        }
    },
    mounted: function() {
        if (this.edit) {
            this.link = Object.assign(this.link, JSON.parse(JSON.stringify(this.edit)));
        }
    },
    methods: {
        done: function() {
            this.$emit('done', this.link);
        }
    },
    components: {
        TablerModal,
        TablerInput,
        TablerToggle,
        TablerEnum
    }
}
</script>
