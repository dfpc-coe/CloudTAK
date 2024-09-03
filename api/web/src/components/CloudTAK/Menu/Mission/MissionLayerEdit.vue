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
                    label='Name'
                    @keyup.enter='editLayer'
                />

                <div class='col-12 d-flex py-3'>
                    <button
                        class='btn btn-secondary'
                        @click='$emit("cancel")'
                    >
                        Cancel
                    </button>
                    <div class='ms-auto'>
                        <button
                            class='btn btn-primary'
                            @click='editLayer'
                        >
                            Save
                        </button>
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
        token: {
            type: String
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
                    headers: {
                        MissionAuthorization: this.token
                    },
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
