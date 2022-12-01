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
                                <div class="col-md-12">
                                    <label class="row">
                                        <span class="col">
                                            <label class='form-label'>Connection Name</label>
                                        </span>
                                        <span class="col-auto">
                                            <label class="form-check form-check-single form-switch">
                                                <input v-model='enabled' class="form-check-input" type="checkbox">
                                            </label>
                                        </span>
                                    </label>
                                    <input v-model='name' type="text" :class='{
                                        "is-invalid": errors.name
                                    }' class="form-control" placeholder="Connection Name">
                                    <div v-if='errors.name' v-text='errors.name' class="invalid-feedback"></div>
                                </div>
                                <div class="col-md-12">
                                    <label class="form-label">Connection Description</label>
                                    <textarea v-model='description' :class='{
                                        "is-invalid": errors.description
                                    }' class="form-control" rows="6" placeholder="Connection Description..."></textarea>
                                    <div v-if='errors.description' v-text='errors.description' class="invalid-feedback"></div>
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

    <Err v-if='err' :err='err' @close='err = null'/>
    <PageFooter/>
</div>
</template>

<script>
import PageFooter from './PageFooter.vue';
import { Err } from '@tak-ps/vue-tabler';

export default {
    name: 'ConnectionNew',
    data: function() {
        return {
            err: false,
            errors: {
                name: false,
                description: false,
            },
            name: '',
            description: '',
            enabled: true,
        }
    },
    methods: {
        create: async function() {
            for (const field of ['name', 'description' ]) {
                if (!this[field]) this.errors[field] = 'Cannot be empty';
                else this.errors[field] = false;
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
                        enabled: this.enabled,
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
        PageFooter,
    }
}
</script>
