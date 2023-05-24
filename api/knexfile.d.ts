export default {
    client: string;
    connection: string;
    pool: {
        min: number;
        max: number;
    },
    migrations: {
        tableName: string;
        stub: string;
        directory: string;
    }
}
