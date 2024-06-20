<template>
    <div class='col-12 border rounded my-2'>
        <TablerAlert
            v-if='err'
            :err='err'
        />
        <TablerLoading v-else-if='loading.layer' />
        <template v-else>
            <div class='modal-body mx-2'>
                <TablerInput
                    v-model='editing.name'
                    @keyup.enter='editLayer'
                    label='Name'
                />

                <div class='col-12 d-flex py-3'>
                    <button @click='$emit("cancel")' class='btn btn-secondary'>Cancel</button>
                    <div class='ms-auto'>
                        <button @click='editLayer' class='btn btn-primary'>Save</button>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerAlert,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'MissionLayerEdit',
    components: {
        TablerAlert,
        TablerLoading,
        TablerInput,
    },
    props: {
        mission: {
            type: Object
        },
        layer: {
            type: Object
        }
    },
    emits: ['layer', 'cancel'],
    data: function() {
        return {
            err: null,
            loading: {
                layer: false,
            },
            editing: JSON.parse(JSON.stringify(this.layer))
        }
    },
    methods: {
        editLayer: async function() {
            try {
                this.loading.layer = true;

                const url = stdurl(`/api/marti/missions/${this.mission.name}/layer/${this.layer.uid}`);

                await std(url, {
                    method: 'PATCH',
                    body: {
                        name: this.editing.name
                    }
                });

                this.$emit('layer', {
                    ...this.layer,
                    name: this.editing.name,
                });
            } catch (err) {
                this.err = err;
            }
            this.loading.layer = false;
        }
    }
}
</script>
