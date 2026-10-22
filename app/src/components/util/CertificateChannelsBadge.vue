<template>
    <TablerBadge
        v-if='certificate?.channels === true'
        background-color='rgba(34, 197, 94, 0.15)'
        border-color='rgba(34, 197, 94, 0.35)'
        text-color='#15803d'
        title='TAK Server honours channel selection for this certificate'
    >
        {{ enabledLabel }}
    </TablerBadge>
    <TablerBadge
        v-else-if='certificate?.channels === false'
        background-color='rgba(249, 115, 22, 0.15)'
        border-color='rgba(249, 115, 22, 0.35)'
        text-color='#c2410c'
        title='Issued without the channels Extended Key Usage - TAK Server ignores channel selection for this certificate'
    >
        {{ disabledLabel }}
    </TablerBadge>
</template>

<script setup lang='ts'>
/**
 * Channels Enabled / Disabled badge for any API object carrying public
 * certificate metadata - renders nothing when the state is unknown
 */
import { TablerBadge } from '@tak-ps/vue-tabler';
import type { CertificateMetadata } from '../../utils/certificate.ts';

withDefaults(defineProps<{
    certificate?: CertificateMetadata | null;
    enabledLabel?: string;
    disabledLabel?: string;
}>(), {
    certificate: null,
    enabledLabel: 'Channels',
    disabledLabel: 'No Channels',
});
</script>
