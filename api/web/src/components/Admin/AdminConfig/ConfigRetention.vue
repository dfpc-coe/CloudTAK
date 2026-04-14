<template>
    <SlideDownHeader
        v-model='isOpen'
        label='Retention'
    >
        <template #right>
            <TablerIconButton
                v-if='!edit && isOpen'
                title='Edit'
                @click.stop='edit = true'
            >
                <IconPencil stroke='1' />
            </TablerIconButton>
            <div
                v-else-if='edit && isOpen'
                class='d-flex gap-1'
            >
                <TablerIconButton
                    color='rgba(var(--tblr-primary-rgb), 0.14)'
                    title='Save'
                    @click.stop='save'
                >
                    <IconDeviceFloppy
                        color='rgb(var(--tblr-primary-rgb))'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerIconButton
                    title='Cancel'
                    @click.stop='edit = false; fetch()'
                >
                    <IconX stroke='1' />
                </TablerIconButton>
            </div>
        </template>
        <div class='col-lg-12 py-2 px-2 border rounded'>
            <TablerLoading v-if='loading' />
            <template v-else>
                <TablerAlert
                    v-if='err'
                    :err='err'
                />

                <div class='row'>
                    <div class='col-lg-12'>
                        <TablerToggle
                            v-model='config["retention::enabled"]'
                            :disabled='!edit'
                            label='Enable Retention Service'
                        />
                    </div>

                    <div
                        v-if='config["retention::enabled"]'
                        class='col-lg-12'
                    >
                        <TablerToggle
                            v-model='config["retention::connection-feature::enabled"]'
                            :disabled='!edit'
                            label='Enable Connection Feature Retention'
                        />
                    </div>

                    <div
                        v-if='config["retention::enabled"]'
                        class='col-lg-12'
                    >
                        <TablerToggle
                            v-model='config["retention::chat::enabled"]'
                            :disabled='!edit'
                            label='Enable Chat Retention'
                        />
                    </div>

                    <div
                        v-if='config["retention::enabled"] && config["retention::chat::enabled"]'
                        class='col-lg-12'
                    >
                        <TablerInput
                            v-model='config["retention::chat::days"]'
                            :disabled='!edit'
                            type='number'
                            label='Chat Retention (Days)'
                            :min='1'
                        />
                    </div>

                    <div
                        v-if='config["retention::enabled"]'
                        class='col-lg-12'
                    >
                        <TablerToggle
                            v-model='config["retention::import::enabled"]'
                            :disabled='!edit'
                            label='Enable Import Retention'
                        />
                    </div>

                    <div
                        v-if='config["retention::enabled"] && config["retention::import::enabled"]'
                        class='col-lg-12'
                    >
                        <TablerInput
                            v-model='config["retention::import::days"]'
                            :disabled='!edit'
                            type='number'
                            label='Import Retention (Days)'
                            :min='1'
                        />
                    </div>
                </div>
            </template>
        </div>
    </SlideDownHeader>
</template>

<script setup lang="ts">
import SlideDownHeader from '../../CloudTAK/util/SlideDownHeader.vue';
import { onMounted, ref, watch } from 'vue';
import { std, stdurl } from '../../../std.ts';
import {
    TablerLoading,
    TablerToggle,
    TablerInput,
    TablerIconButton,
    TablerAlert,
} from '@tak-ps/vue-tabler';
import {
    IconPencil,
    IconDeviceFloppy,
    IconX,
} from '@tabler/icons-vue';

interface RetentionConfig {
    'retention::enabled': boolean;
    'retention::connection-feature::enabled': boolean;
    'retention::chat::enabled': boolean;
    'retention::chat::days': number;
    'retention::import::enabled': boolean;
    'retention::import::days': number;
}

const isOpen = ref<boolean>(false);
const loading = ref<boolean>(false);
const edit = ref<boolean>(false);
const err = ref<Error | null>(null);

const config = ref<RetentionConfig>({
    'retention::enabled': true,
    'retention::connection-feature::enabled': true,
    'retention::chat::enabled': false,
    'retention::chat::days': 30,
    'retention::import::enabled': false,
    'retention::import::days': 30,
});

onMounted(() => {
    if (isOpen.value) void fetch();
});

watch(isOpen, (newState) => {
    if (newState && !edit.value) void fetch();
});

async function fetch(): Promise<void> {
    loading.value = true;
    err.value = null;

    try {
        const url = stdurl('/api/config');
        url.searchParams.set('keys', Object.keys(config.value).join(','));
        const res = await std(url) as Partial<RetentionConfig>;

        config.value = {
            'retention::enabled': res['retention::enabled'] ?? true,
            'retention::connection-feature::enabled': res['retention::connection-feature::enabled'] ?? true,
            'retention::chat::enabled': res['retention::chat::enabled'] ?? false,
            'retention::chat::days': res['retention::chat::days'] ?? 30,
            'retention::import::enabled': res['retention::import::enabled'] ?? false,
            'retention::import::days': res['retention::import::days'] ?? 30,
        };
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
    }

    loading.value = false;
}

async function save(): Promise<void> {
    loading.value = true;
    err.value = null;

    try {
        await std('/api/config', {
            method: 'PUT',
            body: config.value,
        });

        edit.value = false;
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
        console.error('Failed to save Retention config:', error);
    }

    loading.value = false;
}
</script>