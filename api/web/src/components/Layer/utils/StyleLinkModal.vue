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
            <span class='modal-title'>Edit Link</span>
        </div>
        <div class='modal-body py-4'>
            <StyleTemplate
                v-model='link.remarks'
                label='Link Name'
                :schema='schema'
                class='py-1'
            />
            <StyleTemplate
                v-model='link.url'
                label='Link URL'
                :schema='schema'
                class='py-1'
            />

            <button
                v-if='edit'
                class='btn btn-primary w-100 mt-4'
                @click='done'
            >
                Update
            </button>
            <button
                v-else
                class='btn btn-primary w-100 mt-4'
                @click='done'
            >
                Create
            </button>
        </div>
    </TablerModal>
</template>

<script>
import StyleTemplate from './StyleTemplate.vue';
import {
    TablerModal,
} from '@tak-ps/vue-tabler';

export default {
    name: 'LayerSchemaModal',
    components: {
        TablerModal,
        StyleTemplate,
    },
    props: {
        edit: {
            type: Object,
        },
        schema: {
            type: Object,
            required: true
        }
    },
    emits: [
        'close',
        'done'
    ],
    data: function() {
        return {
            link: {
                remarks: '',
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
    }
}
</script>
