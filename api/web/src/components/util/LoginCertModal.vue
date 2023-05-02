<template>
    <TablerModal>
        <button type="button" class="btn-close" @click='close' aria-label="Close"></button>
        <div class="modal-status bg-yellow"></div>
        <div class='modal-header'>
            <div class='modal-title'>Connection Login</div>
        </div>
        <div class="modal-body row">
            <div class='col-12'>
                <TablerInput
                    label='Connection Username'
                    v-model='username'
                    v-on:keyup.enter='generate'
                />
            </div>
            <div class='col-12 mt-3'>
                <TablerInput
                    label='Connection Password'
                    v-model='password'
                    v-on:keyup.enter='generate'
                />
            </div>
            <div class="col-12 mt-3">
                <div class="col"><a @click='generate' class="cursor-pointer btn w-100">Generate Certificate</a></div>
            </div>
        </div>
    </TablerModal>
</template>

<script>
import {
    TablerModal,
    TablerInput
} from '@tak-ps/vue-tabler';

export default {
    name: 'LoginCertModal',
    data: function() {
        return {
            username: '',
            password: '',
        }
    },
    methods: {
        generate: function() {

        },
        close: function() {
            this.$emit('close');
        },
    },
    components: {
        TablerModal,
        TablerInput
    }
}
</script>
