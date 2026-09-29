<template>
    <TablerPillGroup
        :model-value='route.name === "home-menu-features-events" ? "events" : "features"'
        class='pt-2'
        :options='[
            { value: "features", label: "Saved Features" },
            { value: "events", label: "Events" },
        ]'
        @update:model-value='navigate'
    />
</template>

<script setup lang='ts'>
import { useRoute, useRouter } from 'vue-router';
import { TablerPillGroup } from '@tak-ps/vue-tabler';

const route = useRoute();
const router = useRouter();

function navigate(tab: string): void {
    const name = tab === 'events' ? 'home-menu-features-events' : 'home-menu-features';
    if (route.name === name) return;
    router.replace({ name });
}
</script>
