<template>
    <ApiReference :configuration='configuration' />
</template>

<script setup lang='ts'>
import { stdurl } from '../../std.ts'
import { ApiReference } from '@scalar/api-reference';
import '@scalar/api-reference/style.css';

const configuration = {
    url: String(stdurl('/api/openapi')),
    hideDarkModeToggle: false,
    showSidebar: true,
    hideClientButton: true,
    metaData: {
        title: 'CloudTAK',
    },
};
</script>
