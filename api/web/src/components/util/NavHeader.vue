<template>
    <div class='d-flex align-items-center px-3 py-2 border-bottom nav-header'>
        <img
            class='nav-header-logo me-2 cursor-pointer'
            :src='headerLogo'
            alt='CloudTAK Logo'
            title='CloudTAK Home'
            draggable='false'
            @click='home'
        >
        <div
            v-if='!$slots.left'
            class='fs-3 fw-bold user-select-none'
            v-text='title'
        />
        <div
            v-else
            class='d-flex align-items-center gap-2'
        >
            <slot name='left' />
        </div>

        <div class='d-flex align-items-center gap-2 ms-auto'>
            <slot />

            <TablerDropdown
                v-if='appStore.user'
                :width='170'
            >
                <TablerIconButton title='Profile'>
                    <IconUser
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>

                <template #dropdown>
                    <div
                        class='cursor-pointer col-12 cloudtak-hover d-flex align-items-center px-2 py-2'
                        @click='external("/")'
                    >
                        <IconMap
                            :size='20'
                            stroke='1'
                        />
                        <span class='mx-2'>Map</span>
                    </div>
                    <div
                        class='cursor-pointer col-12 cloudtak-hover d-flex align-items-center px-2 py-2'
                        @click='external("/connection")'
                    >
                        <IconNetwork
                            :size='20'
                            stroke='1'
                        />
                        <span class='mx-2'>Connections</span>
                    </div>
                    <div
                        class='cursor-pointer col-12 cloudtak-hover d-flex align-items-center px-2 py-2'
                        @click='external("/admin")'
                    >
                        <IconSettings
                            :size='20'
                            stroke='1'
                        />
                        <span class='mx-2'>Admin</span>
                    </div>
                    <div
                        class='cursor-pointer col-12 cloudtak-hover d-flex align-items-center px-2 py-2'
                        @click='external("/docs")'
                    >
                        <IconCode
                            :size='20'
                            stroke='1'
                        />
                        <span class='mx-2'>Docs</span>
                    </div>
                    <div
                        class='cursor-pointer col-12 cloudtak-hover d-flex align-items-center px-2 py-2'
                        @click='appStore.logout'
                    >
                        <IconLogout
                            :size='20'
                            stroke='1'
                        />
                        <span class='mx-2'>Logout</span>
                    </div>
                </template>
            </TablerDropdown>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import Config from '../../base/config.ts';
import { useAppStore } from '../../stores/app.ts';
import {
    TablerDropdown,
    TablerIconButton,
} from '@tak-ps/vue-tabler';
import {
    IconMap,
    IconCode,
    IconUser,
    IconLogout,
    IconNetwork,
    IconSettings,
} from '@tabler/icons-vue';

withDefaults(defineProps<{
    title?: string;
}>(), {
    title: undefined
});

const appStore = useAppStore();

const brandLogo = ref<string | undefined>();

const headerLogo = computed(() => {
    return brandLogo.value || '/CloudTAKLogo.svg';
});

onMounted(async () => {
    try {
        const config = await Config.list([
            'login::logo',
        ]);

        brandLogo.value = config['login::logo'];
    } catch (err) {
        // Non-fatal - fall through to the default logo
        console.error('Failed to load login logo', err);
    }
});

function home(): void {
    external('/');
}

function external(url: string): void {
    window.location.href = url;
}
</script>

<style scoped>
/*
 * Colors are intentionally inherited - the header sits on a `.cloudtak-page`
 * surface and the border uses the theme's --tblr-border-color, so it follows
 * light & dark themes without page-specific overrides
 */
.nav-header-logo {
    height: 32px;
    width: 32px;
}
</style>
