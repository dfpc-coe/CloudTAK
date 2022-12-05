<template>
<div>
    <div class='page-wrapper'>
        <div class="page-header d-print-none">
            <div class="container-xl">
                <div class="row g-2 align-items-center">
                    <div class="col d-flex">
                        <ol class="breadcrumb" aria-label="breadcrumbs">
                            <li class="breadcrumb-item"><a @click='$router.push("/")' class="cursor-pointer">Home</a></li>
                            <li class="breadcrumb-item" aria-current="page"><a  @click='$router.push("/layer")' class="cursor-pointer">Layer</a></li>
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
                                    <label class="form-label">Layer Name</label>
                                    <input v-model='name' type="text" :class='{
                                        "is-invalid": errors.name
                                    }' class="form-control" placeholder="Layer Name">
                                    <div v-if='errors.name' v-text='errors.name' class="invalid-feedback"></div>
                                </div>
                                <div class="col-md-6">
                                    <label class="row">
                                        <span class="col">
                                            <label class='form-label'>Scheduled</label>
                                        </span>
                                        <span class="col-auto">
                                            <label class="form-check form-check-single form-switch">
                                                <input v-model='enabled' class="form-check-input" type="checkbox">
                                            </label>
                                        </span>
                                    </label>
                                    <input v-model='cron' type="text" :class='{
                                        "is-invalid": errors.cron
                                    }' class="form-control" placeholder="CRON Schedule">
                                    <div v-if='errors.cron' v-text='errors.cron' class="invalid-feedback"></div>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Layer Task</label>
                                    <input v-model='task' type="text" :class='{
                                        "is-invalid": errors.task
                                    }' class="form-control" placeholder="Layer Task">
                                    <div v-if='errors.task' v-text='errors.task' class="invalid-feedback"></div>
                                </div>
                                <div class="col-md-12">
                                    <label class="form-label">Layer Description</label>
                                    <textarea v-model='description' :class='{
                                        "is-invalid": errors.description
                                    }' class="form-control" rows="6" placeholder="Layer Description..."></textarea>
                                    <div v-if='errors.description' v-text='errors.description' class="invalid-feedback"></div>
                                </div>
                                <div class="col-md-12">
                                    <label class="form-label">Connection</label>
                                    <div v-if='conn.id' class='d-flex'>
                                        <ConnectionStatus :connection='conn'/>
                                        <span class='mt-2' v-text='conn.name'/>
                                    </div>

                                    <div class='table-resposive'>
                                        <table class='table'>
                                            <thead>
                                                <tr>
                                                    <th>(Status) Name</th>
                                                </tr>
                                            </thead>
                                            <tbody class='table-tbody'>
                                                <tr @click='conn = connection' :key='connection.id' v-for='connection of connections.connections' class='cursor-pointer'>
                                                    <td>
                                                        <div class='d-flex'>
                                                            <ConnectionStatus :connection='connection'/>
                                                            <span class='mt-2' v-text='connection.name'/>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div class="col-md-12">
                                    <div class='d-flex'>
                                        <div class='ms-auto'>
                                            <a @click='create' class="cursor-pointer btn btn-primary">
                                                Create Layer
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

    <PageFooter/>
    <Err v-if='err' :err='err' @close='err = null'/>
</div>
</template>

<script>
import ConnectionStatus from './Connection/Status.vue';
import PageFooter from './PageFooter.vue';
import { Err } from '@tak-ps/vue-tabler';

export default {
    name: 'LayerNew',
    data: function() {
        return {
            err: false,
            connections: {
                list: []
            },
            errors: {
                name: false,
                description: false,
                cron: false,
                task: false
            },
            conn: {
                id: null,
                status: '',
                name: ''
            },
            name: '',
            description: '',
            enabled: true,
            cron: '0/15 * * * ? *',
            task: ''
        }
    },
    mounted: function() {
        this.listConnections();
    },
    methods: {
        listConnections: async function() {
            try {
                this.connections = await window.std('/api/connection');
            } catch (err) {
                this.err = err;
            }
        },
        create: async function() {
            for (const field of ['name', 'description', 'cron', 'task']) {
                if (!this[field]) this.errors[field] = 'Cannot be empty';
                else this.errors[field] = false;
            }

            for (const e in this.errors) {
                if (this.errors[e]) return;
            }

            try {
                const create = await window.std('/api/layer', {
                    method: 'POST',
                    body: {
                        name: this.name,
                        description: this.description,
                        enabled: this.enabled,
                        connection: this.conn.id,
                        cron: this.cron,
                        task: this.task
                    }
                });

                this.$router.push(`/layer/${create.id}`);
            } catch (err) {
                this.err = err;
            }
        }
    },
    components: {
        Err,
        PageFooter,
        ConnectionStatus
    }
}
</script>
