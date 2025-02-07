<template>
    <div class='col-12 border rounded my-2'>
        <TablerAlert
            v-if='err'
            :err='err'
        />
        <TablerLoading v-else-if='loading.layer' />
        <template v-else>
            <div class='modal-body row g-2'>
                <TablerInput
                    v-model='layer.name'
                    label='Name'
                    @keyup.enter='createLayer'
                />

                <label
                    class='subheader mt-3 cursor-pointer'
                    @click='advanced = !advanced'
                >
                    <IconSquareChevronRight
                        v-if='!advanced'
                        :size='32'
                        stroke='1'
                    />
                    <IconChevronDown
                        v-else
                        :size='32'
                        stroke='1'
                    />
                    Advanced Options
                </label>

                <div
                    v-if='advanced'
                    class='col-12'
                >
                    <div class='row g-2'>
                        <div class='col-12'>
                            <TablerEnum
                                v-model='layer.type'
                                label='Layer Type'
                                :options='["GROUP", "UID", "CONTENTS", "MAPLAYER", "ITEM"]'
                            />
                        </div>
                    </div>
                </div>

                <div class='col-12 d-flex'>
                    <button
                        class='btn btn-secondary'
                        @click='$emit("cancel")'
                    >
                        Cancel
                    </button>
                    <div class='ms-auto'>
                        <button
                            class='btn btn-primary'
                            @click='createLayer'
                        >
                            Create Layer
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
    IconSquareChevronRight,
    IconChevronDown,
} from '@tabler/icons-vue';
import {
    TablerAlert,
    TablerInput,
    TablerEnum,
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'MissionLayerCreate',
    components: {
        IconSquareChevronRight,
        IconChevronDown,
        TablerAlert,
        TablerLoading,
        TablerInput,
        TablerEnum,
    },
    props: {
        mission: Object,
        token: String
    },
    emits: ['layer', 'cancel'],
    data: function() {
        return {
            err: null,
            loading: {
                layer: false,
            },
            advanced: false,
            layer: {
                name: '',
                type: 'GROUP'
            }
        }
    },
    methods: {
        createLayer: async function() {
            try {
                this.loading.layer = true;

                const url = stdurl(`/api/marti/missions/${this.mission.name}/layer`);

                const res = await std(url, {
                    method: 'POST',
                    body: this.layer,
                    headers: {
                        MissionAuthorization: this.token
                    }
                });

                this.$emit('layer', res.data[0]);
            } catch (err) {
                this.err = err;
            }
            this.loading.layer = false;
        }
    }
}
</script>
