<template>
    <div>
        <div id='swagger' />
    </div>
</template>

<script setup lang='ts'>
import { stdurl } from '../../std.ts'
import { onMounted } from 'vue'
import SwaggerUI from 'swagger-ui-dist/swagger-ui-bundle.js';
import 'swagger-ui-dist/swagger-ui.css';

onMounted(() => {
    SwaggerUI({
        dom_id: '#swagger',
        url: String(stdurl('/api/openapi'))
    })
})
</script>
