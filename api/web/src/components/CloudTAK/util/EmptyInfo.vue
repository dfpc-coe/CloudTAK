<template>
    <div
        class='col-12 d-flex py-2 px-2 align-items-center user-select-none'
        :class='{
            "justify-content-center": !props.button
        }'
    >
        <template v-if='props.type === "Channels"'>
            <IconAlertCircle
                :size='32'
                stroke='2'
                color='red'
                class='mx-2'
            />

            <div class='text-red'>
                No Channels are active
            </div>

            <div
                v-if='props.button'
                class='ms-auto'
            >
                <TablerIconButton
                    title='Channel Selection'
                    @click='router.push("/menu/channels")'
                >
                    <IconAffiliate
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </template>
        <template v-else-if='props.type === "Missions"'>
            <IconAlertCircle
                :size='32'
                stroke='2'
                class='mx-2'
            />

            <div class='text-red'>
                No Data Syncs have been subscribed to that have Write Access
            </div>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { useRouter } from 'vue-router';
import {
    IconAffiliate,
    IconAlertCircle
} from '@tabler/icons-vue';
import {
    TablerIconButton
} from '@tak-ps/vue-tabler';

const router = useRouter();

const props = defineProps({
    type: {
        type: String,
        default: 'Channels'
    },
    button: {
        type: Boolean,
        default: true
    }
})
</script>
