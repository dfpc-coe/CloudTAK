<template>
<div>
    <div class='page-wrapper'>
        <div class="page-header d-print-none">
            <div class="container-xl">
                <div class="row g-2 align-items-center">
                    <div class="col d-flex">
                        <ol class="breadcrumb" aria-label="breadcrumbs">
                            <li class="breadcrumb-item"><a @click='$router.push("/")' class="cursor-pointer">Home</a></li>
                            <li class="breadcrumb-item" aria-current="page"><a  @click='$router.push("/connection")' class="cursor-pointer">Connection</a></li>
                            <li class="breadcrumb-item active" aria-current="page"><a href="#">New</a></li>
                        </ol>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class='page-body'>
        <div class='container-xl'>
            <div class='row row-deck row-cards'>
                <div class="col-lg-12">
                    <div class="card">
                        <div class="card-body">
                            <div class='row row-cards'>
                                <div class="col-md-12 mt-3">
                                    <TablerInput
                                        label='Connection Name'
                                        v-model='name'
                                        :error='errors.name'
                                    />
                                </div>
                                <div class="col-md-12">
                                    <TablerInput
                                        label='Connection Description'
                                        v-model='description'
                                        :error='errors.description'
                                        :rows='6'
                                    />
                                </div>

                                <div class='col-md-12'>
                                    <div class='d-flex'>
                                        <h3>Authentication</h3>

                                        <div class='ms-auto'>
                                            <a @click='upload = true' class="cursor-pointer btn btn-outline-secondary">
                                                Upload .p12
                                            </a>
                                        </div>
                                    </div>

                                    <div class='row mt-3'>
                                        <div class="col-md-6">
                                            <TablerInput
                                                label='Connection Cert'
                                                v-model='description'
                                                :error='errors.description'
                                                :rows='6'
                                            />
                                        </div>
                                        <div class="col-md-6">
                                            <TablerInput
                                                label='Connection Key'
                                                v-model='description'
                                                :error='errors.description'
                                                :rows='6'
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div class="col-md-12">
                                    <div class='d-flex'>
                                        <div class='ms-auto'>
                                            <a @click='create' class="cursor-pointer btn btn-primary">
                                                Create Connection
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <Upload
        v-if='upload'
        @close='upload = false'

    />

    <Err v-if='err' :err='err' @close='err = null'/>
    <PageFooter/>
</div>
</template>

<script>
import PageFooter from './PageFooter.vue';
import Upload from './util/Upload.vue';
import {
    Err,
    Input
} from '@tak-ps/vue-tabler';

export default {
    name: 'ConnectionNew',
    data: function() {
        return {
            err: false,
            upload: false,
            errors: {
                name: '',
                description: '',
            },
            name: '',
            description: '',
        }
    },
    methods: {
        create: async function() {
            for (const field of ['name', 'description' ]) {
                if (!this[field]) this.errors[field] = 'Cannot be empty';
                else this.errors[field] = '';
            }

            for (const e in this.errors) {
                if (this.errors[e]) return;
            }

            try {
                const create = await window.std('/api/connection', {
                    method: 'POST',
                    body: {
                        name: this.name,
                        description: this.description,
                        enabled: true,
                        auth: {}
                    }
                });

                this.$router.push(`/connection/${create.id}`);
            } catch (err) {
                this.err = err;
            }
        }
    },
    components: {
        Err,
        Upload,
        TablerInput: Input,
        PageFooter,
    }
}
</script>
