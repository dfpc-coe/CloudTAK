<template>
<TablerModal>
    <div class="modal-status bg-yellow"></div>
    <button type="button" class="btn-close" @click='$emit("close")' aria-label="Close"></button>
    <div class='modal-header'>
        <div class='modal-title' v-text='token.id ? "Edit Token" : "New Token"'/>

        <div class='ms-auto btn-list'>
            <TablerDelete v-if='editToken.id' @delete='deleteToken' displaytype='icon'/>
        </div>
    </div>

    <div class='modal-body row'>
        <div v-if='!code' class='col-12'>
            <TablerInput label='Token Name' v-model='editToken.name'/>
        </div>
        <div v-else class='col-12'>
            <pre v-text='code'/>
        </div>
    </div>
    <div class='modal-footer'>
        <button v-if='!code' @click='saveToken' class='btn btn-primary'>Save</button>
        <button v-else @click='$emit("refresh")' class='btn btn-primary'>Close</button>
    </div>
</TablerModal>
</template>

<script>
import { std, stdurl } from '/std.ts';
import {
    TablerModal,
    TablerInput,
    TablerDelete
} from '@tak-ps/vue-tabler'

export default {
    name: 'TokenModal',
    props: {
        token: {
            type: Object,
            required: true
        }
    },
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
            await std(`/api/connection/${this.$route.params.connectionid}/token/${this.token.id}`, {
                method: 'DELETE',
            });

            this.$emit('refresh');
        },
        saveToken: async function() {
            if (this.token.id) {
                const newtoken = await std(`/api/connection/${this.$route.params.connectionid}/token/${this.token.id}`, {
                    method: 'PATCH',
                    body: this.editToken
                });
                this.$emit('refresh');
            } else {
                const newtoken = await std(`/api/connection/${this.$route.params.connectionid}/token`, {
                    method: 'POST',
                    body: this.editToken
                });

                this.code = newtoken.token;
            }
        },
    },
    components: {
        TablerModal,
        TablerInput,
        TablerDelete
    }
}
</script>
