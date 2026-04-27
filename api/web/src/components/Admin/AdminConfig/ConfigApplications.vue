<template>
    <SlideDownHeader
        v-model='isOpen'
        label='External Applications'
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

                <div class='d-flex align-items-center justify-content-between mb-3'>
                    <p class='text-secondary mb-0'>
                        Configure application shortcuts that point users to external tools and services.
                    </p>

                    <TablerIconButton
                        v-if='edit'
                        title='Add Application'
                        @click='addApplication()'
                    >
                        <IconPlus
                            color='rgb(var(--tblr-primary-rgb))'
                            stroke='1'
                        />
                    </TablerIconButton>
                </div>

                <template v-if='config["external::applications"].length'>
                    <div
                        v-for='(application, index) in config["external::applications"]'
                        :key='index'
                        class='border rounded p-3 mb-3'
                    >
                        <div class='d-flex align-items-center justify-content-between mb-3'>
                            <h4 class='card-title mb-0'>
                                Application {{ index + 1 }}
                            </h4>

                            <TablerIconButton
                                v-if='edit'
                                title='Remove Application'
                                @click='removeApplication(index)'
                            >
                                <IconTrash
                                    color='rgb(var(--tblr-danger-rgb))'
                                    stroke='1'
                                />
                            </TablerIconButton>
                        </div>

                        <div class='row g-3'>
                            <div
                                v-if='!edit && application.icon'
                                class='col-lg-3 col-md-4'
                            >
                                <label class='form-label'>Application Logo</label>
                                <div class='border rounded d-flex align-items-center justify-content-center p-3 h-100'>
                                    <img
                                        :src='application.icon'
                                        alt='Application logo'
                                        class='img-fluid'
                                        style='max-height: 120px; object-fit: contain;'
                                    >
                                </div>
                            </div>

                            <div :class='!edit && application.icon ? "col-lg-9 col-md-8" : "col-12"'>
                                <TablerInput
                                    v-model='application.name'
                                    :disabled='!edit'
                                    :error='edit ? applicationNameError(application) : ""'
                                    label='Application Name'
                                    placeholder='Example App'
                                />

                                <TablerInput
                                    v-model='application.url'
                                    :disabled='!edit'
                                    :error='edit ? applicationUrlError(application) : ""'
                                    label='Application URL'
                                    placeholder='https://example.com'
                                />

                                <UploadLogo
                                    v-if='edit'
                                    v-model='application.icon'
                                    :input-id='`external-application-logo-${index}`'
                                    label='Application Logo'
                                />
                            </div>
                        </div>
                    </div>
                </template>

                <TablerNone
                    v-else
                    label='No external applications configured'
                    :create='false'
                />
            </template>
        </div>
    </SlideDownHeader>
</template>

<script setup lang="ts">
import SlideDownHeader from '../../CloudTAK/util/SlideDownHeader.vue';
import { ref, watch, onMounted } from 'vue';
import { server } from '../../../std.ts';
import { validateTextNotEmpty, validateURL } from '../../../base/validators.ts';
import {
    TablerLoading,
    TablerNone,
    TablerInput,
    TablerIconButton,
    TablerAlert
} from '@tak-ps/vue-tabler';
import UploadLogo from '../../util/UploadLogo.vue';
import {
    IconPencil,
    IconDeviceFloppy,
    IconPlus,
    IconTrash,
    IconX
} from '@tabler/icons-vue';

type ExternalApplication = {
    name: string;
    icon: string;
    url: string;
};

type ExternalApplicationsConfig = {
    'external::applications': ExternalApplication[];
};

function createApplication(): ExternalApplication {
    return {
        name: '',
        icon: '',
        url: '',
    };
}

function cloneApplications(applications: unknown): ExternalApplication[] {
    if (!Array.isArray(applications)) return [];

    return applications.map((application) => {
        const value = application as Partial<ExternalApplication> | null;

        return {
            name: typeof value?.name === 'string' ? value.name : '',
            icon: typeof value?.icon === 'string' ? value.icon : '',
            url: typeof value?.url === 'string' ? value.url : '',
        };
    });
}

const isOpen = ref(false);
const loading = ref(false);
const edit = ref(false);
const err = ref<Error | null>(null);

const config = ref<ExternalApplicationsConfig>({
    'external::applications': [],
});

onMounted(() => {
    if (isOpen.value) void fetch();
});

watch(isOpen, (newState) => {
    if (newState && !edit.value) void fetch();
});

function applicationNameError(application: ExternalApplication): string {
    return validateTextNotEmpty(application.name.trim());
}

function applicationUrlError(application: ExternalApplication): string {
    const url = application.url.trim();
    if (!url) return 'This field cannot be empty';
    return validateURL(url);
}

function isEmptyApplication(application: ExternalApplication): boolean {
    return !application.name.trim() && !application.url.trim() && !application.icon.trim();
}

function addApplication(): void {
    config.value['external::applications'].push(createApplication());
}

function removeApplication(index: number): void {
    config.value['external::applications'].splice(index, 1);
}

async function fetch(): Promise<void> {
    loading.value = true;
    err.value = null;

    try {
        const { data, error } = await server.GET('/api/config', {
            params: {
                query: {
                    keys: 'external::applications'
                }
            }
        });
        if (error) throw new Error(error.message);

        config.value['external::applications'] = cloneApplications(data['external::applications']);
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
    }

    loading.value = false;
}

async function save(): Promise<void> {
    loading.value = true;
    err.value = null;

    try {
        const applications = cloneApplications(config.value['external::applications'])
            .map((application) => ({
                name: application.name.trim(),
                icon: application.icon,
                url: application.url.trim(),
            }))
            .filter((application) => !isEmptyApplication(application));

        const invalid = applications.find((application) => {
            return Boolean(applicationNameError(application) || applicationUrlError(application));
        });

        if (invalid) {
            throw new Error(`Invalid application entry: ${applicationNameError(invalid) || applicationUrlError(invalid)}`);
        }

        const { error } = await server.PUT('/api/config', {
            body: {
                'external::applications': applications,
            }
        });
        if (error) throw new Error(error.message);

        edit.value = false;
        await fetch();
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
        console.error('Failed to save external applications config:', error);
    }

    loading.value = false;
}
</script>
