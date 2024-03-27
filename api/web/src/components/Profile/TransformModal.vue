<template>
    <TablerModal>
        <button type="button" class="btn-close" @click='$emit("close")' aria-label="Close"></button>
        <div class="modal-status bg-yellow"></div>
        <div class="modal-body py-4">
            <h3 class='subtitle-header'>Asset Transform:</h3>

            <TablerLoading v-if='loading' desc='Creating Transform Job'/>
            <template v-else>
                <div class='modal-body'>
                    Submit the for conversion into a TAK &amp; Cloud Native Format
                </div>

                <div class='col-12 d-flex'>
                    <div class='ms-auto'>
                        <button @click='submit' class='btn btn-primary'>Submit</button>
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
    props: {
        asset: {
            type: Object,
            required: true
        }
    },
    data: function() {
        return {
            loading: false,
        }
    },
    methods: {
        submit: async function() {
            this.loading = true;
            await std(`/api/profile/asset/${this.asset.name}`, {
                method: 'POST',
            });
            this.loading = false;
            this.$emit('done');
            this.$emit('close');
        },
    },
    components: {
        TablerModal,
        TablerLoading,
    }
}
</script>
