<template>
    <TablerModal>
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='$emit("close")'
        />
        <div class='modal-status bg-yellow' />
        <div class='modal-body py-4'>
            <h3 class='subtitle-header'>
                Asset Transform:
            </h3>

            <TablerLoading
                v-if='loading'
                desc='Creating Transform Job'
            />
            <template v-else>
                <div class='modal-body'>
                    Submit the for conversion into a TAK &amp; Cloud Native Format
                </div>

                <div class='col-12 d-flex'>
                    <div class='ms-auto'>
                        <button
                            class='btn btn-primary'
                            @click='submit'
                        >
                            Submit
                        </button>
                    </div>
                </div>
            </template>
        </div>
    </TablerModal>
</template>

<script>
import { std } from '/src/std.ts';
import {
    TablerModal,
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'TransformModal',
    components: {
        TablerModal,
        TablerLoading,
    },
    props: {
        asset: {
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
            loading: false,
        }
    },
    methods: {
        submit: async function() {
            this.loading = true;
            await std(`/api/connection/${this.$route.params.connectionid}/data/${this.$route.params.dataid}/asset/${this.asset.name}`, {
                method: 'POST',
            });
            this.loading = false;
            this.$emit('done');
            this.$emit('close');
        },
    }
}
</script>
