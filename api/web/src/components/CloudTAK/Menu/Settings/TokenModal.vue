<template>
    <TablerModal>
        <div class='modal-status bg-yellow' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='$emit("close")'
        />
        <div class='modal-header'>
            <div
                class='modal-title'
                v-text='token.id ? "Edit Token" : "New Token"'
            />

            <div class='ms-auto btn-list'>
                <TablerDelete
                    v-if='editToken.id'
                    displaytype='icon'
                    @delete='deleteToken'
                />
            </div>
        </div>

        <div class='modal-body row'>
            <div
                v-if='!code'
                class='col-12'
            >
                <TablerInput
                    v-model='editToken.name'
                    label='Token Name'
                    @keyup.enter='saveToken'
                />
            </div>
            <div
                v-else
                class='col-12'
            >
                <pre v-text='code' />
            </div>
        </div>
        <div class='modal-footer'>
            <button
                v-if='!code'
                class='btn btn-primary'
                @click='saveToken'
            >
                Save
            </button>
            <button
                v-else
                class='btn btn-primary'
                @click='$emit("refresh")'
            >
                Close
            </button>
        </div>
    </TablerModal>
</template>

<script>
import { std } from '/src/std.ts';
import {
    TablerModal,
    TablerInput,
    TablerDelete
} from '@tak-ps/vue-tabler'

export default {
    name: 'TokenModal',
    components: {
        TablerModal,
        TablerInput,
        TablerDelete
    },
    props: {
        token: {
            type: Object,
            required: true
        }
    },
    emits: [
        'close',
        'refresh'
    ],
    data: function() {
        if (this.token.id) {
            return {
                code: false,
                editToken: JSON.parse(JSON.stringify(this.token))
            }
        } else {
            return {
                code: false,
                editToken: {
                    name: ''
                }
            }

        }
    },
    methods: {
        deleteToken: async function() {
            await std(`/api/profile/token/${this.token.id}`, {
                method: 'DELETE',
            });

            this.$emit('refresh');
        },
        saveToken: async function() {
            if (this.token.id) {
                await std(`/api/profile/token/${this.token.id}`, {
                    method: 'PATCH',
                    body: this.editToken
                });
                this.$emit('refresh');
            } else {
                const newtoken = await std('/api/profile/token', {
                    method: 'POST',
                    body: this.editToken
                });

                this.code = newtoken.token;
            }
        },
    }
}
</script>
