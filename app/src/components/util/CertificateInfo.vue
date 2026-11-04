<template>
    <div class='datagrid-item'>
        <div class='datagrid-title'>
            Certificate Valid From
        </div>
        <div
            class='datagrid-content'
            v-text='certificate?.validFrom || "Unknown"'
        />
    </div>
    <div class='datagrid-item'>
        <div class='datagrid-title'>
            Certificate Valid To
        </div>
        <div class='datagrid-content d-flex align-items-center gap-2'>
            <div v-text='certificate?.validTo || "Unknown"' />
            <CertificateBadge
                class='ms-auto'
                :certificate='certificate'
                expired-label='Expired Certificate'
            />
        </div>
    </div>
    <div class='datagrid-item'>
        <div class='datagrid-title'>
            Certificate Subject
        </div>
        <div
            class='datagrid-content'
            v-text='certificate?.subject || "Unknown"'
        />
    </div>
    <div class='datagrid-item'>
        <div class='datagrid-title'>
            Channels Enabled
        </div>
        <div class='datagrid-content'>
            <CertificateChannelsBadge
                v-if='typeof certificate?.channels === "boolean"'
                :certificate='certificate'
                enabled-label='Enabled'
                disabled-label='Disabled'
            />
            <span
                v-else
                v-text='"Unknown"'
            />
        </div>
    </div>
</template>

<script setup lang='ts'>
/**
 * Generic certificate datagrid items (Valid From / Valid To + expiry badge / Subject / Channels)
 * Must be rendered inside a `.datagrid` container
 */
import CertificateBadge from './CertificateBadge.vue';
import CertificateChannelsBadge from './CertificateChannelsBadge.vue';
import type { CertificateMetadata } from '../../utils/certificate.ts';

withDefaults(defineProps<{
    certificate?: CertificateMetadata | null;
}>(), {
    certificate: null,
});
</script>
