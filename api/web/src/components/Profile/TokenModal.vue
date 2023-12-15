<template>
<TablerModal>
    <div class="modal-status bg-yellow"></div>
    <button type="button" class="btn-close" @click='$emit("close")' aria-label="Close"></button>
    <div class='modal-header'>
        <div class='modal-title' v-text='token ? "Edit Token" : "New Token"'/>

        <div class='ms-auto btn-list'>
            <TablerDelete v-if='editToken.id' @delete='deleteToken' displaytype='icon'/>
        </div>
    </div>

    <div class='modal-body row'>
        <div class='col-12'>
            <TablerInput label='Token Name' v-model='editToken.name'/>
        </div>
    </div>
    <div class='modal-footer'>
        <button @click='saveToken' class='btn btn-primary'>Save</button>
    </div>
</TablerModal>
</template>

<script>
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
        if (this.token) {
            return {
                editToken: JSON.parse(JSON.stringify(this.token))
            }
        } else {
            return {
                editToken: {
                    name: ''
                }
            }

        }
    },
    methods: {
        deleteToken: async function() {
            await window.std(`/api/token/${this.token.id}`, {
                method: 'DELETE',
            });

            this.$emit('refresh');
        },
        saveToken: async function() {
            if (this.token.id) {
                const newtoken = await window.std(`/api/token/${this.token.id}`, {
                    method: 'PATCH',
                    body: this.editToken
                });
                this.$emit('refresh');
            } else {
                const newtoken = await window.std('/api/token', {
                    method: 'POST',
                    body: this.editToken
                });
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
