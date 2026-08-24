<template>
    <TablerBadge
        v-if='state === "expired"'
        background-color='rgba(220, 38, 38, 0.15)'
        border-color='rgba(220, 38, 38, 0.35)'
        text-color='#b91c1c'
    >
        {{ expiredLabel }}
    </TablerBadge>
    <TablerBadge
        v-else-if='state === "near-expiry"'
        background-color='rgba(249, 115, 22, 0.15)'
        border-color='rgba(249, 115, 22, 0.35)'
        text-color='#c2410c'
    >
        {{ nearExpiryLabel }}
    </TablerBadge>
</template>

<script setup lang='ts'>
/**
 * Generic Expired / Near Expiry badge for any API object carrying
 * public certificate metadata - renders nothing for a healthy certificate
 */
import { computed } from 'vue';
import { TablerBadge } from '@tak-ps/vue-tabler';
import { certificateExpiryState, type CertificateMetadata } from '../../utils/certificate.ts';

const props = withDefaults(defineProps<{
    certificate?: CertificateMetadata | null;
    expiredLabel?: string;
    nearExpiryLabel?: string;
}>(), {
    certificate: null,
    expiredLabel: 'Expired',
    nearExpiryLabel: 'Near Expiry',
});

const state = computed(() => certificateExpiryState(props.certificate?.validTo));
</script>
