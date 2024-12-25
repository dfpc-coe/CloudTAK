<template>
    <div style='overflow: auto;'>
        <div class='page-wrapper'>
            <div class='page-header d-print-none'>
                <div class='container-xl'>
                    <div class='row g-2 align-items-center'>
                        <div class='col d-flex text-white'>
                            <TablerBreadCrumb />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class='page-body'>
            <div class='container-xl'>
                <div class='row row-deck row-cards'>
                    <TablerLoading v-if='!connection' />
                    <div
                        v-else
                        class='col-lg-12'
                    >
                        <ConnectionSinks
                            :connection='connection'
                        />
                    </div>
                </div>
            </div>
        </div>
        <PageFooter />
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { std } from '../std.ts';
import type { ETLConnection } from '../types.ts';
import PageFooter from './PageFooter.vue';
import ConnectionSinks from './Connection/Sinks.vue';
import {
    TablerBreadCrumb,
    TablerLoading
} from '@tak-ps/vue-tabler';

const route = useRoute();
const connection = ref<ETLConnection>();

onMounted(async () => {
    await fetch();
})

async function fetch() {
    connection.value = await std(`/api/connection/${route.params.connectionid}`) as ETLConnection;
}
</script>
