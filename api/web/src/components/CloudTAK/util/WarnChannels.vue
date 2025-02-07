<template>
    <TablerModal>
        <div class='modal-status bg-red' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='$emit("close")'
        />
        <div class='modal-header text-white'>
            <div class='d-flex align-items-center'>
                <IconInfoSquare
                    :size='28'
                    stroke='1'
                />
                <span class='mx-2'>No Channels Selected</span>
            </div>
        </div>
        <div class='modal-body text-white'>
            <p>Channels are the basis of who and what you are able to see in TAK</p>

            <p>At this time you do not have any active channels and as such you will not see any Users, Data Packages, or Data Syncs associated with channels.</p>

            <p>It is recommended to turn on relevant channels now</p>

            <div class='d-flex align-items-center'>
                <div class='ms-auto btn-list'>
                    <button
                        class='btn btn-primary'
                        @click='selectChannels'
                    >
                        Select Channels
                    </button>
                </div>
            </div>
        </div>
    </TablerModal>
</template>

<script>
import {
    TablerModal,
} from '@tak-ps/vue-tabler';
import {
    IconInfoSquare,
} from '@tabler/icons-vue';

export default {
    name: 'WarnChannels',
    components: {
        TablerModal,
        IconInfoSquare,
    },
    emits: [
        'close'
    ],
    methods: {
        selectChannels: function() {
            this.$emit('close');
            this.$router.push('/menu/channels');
        },
    }
}
</script>
