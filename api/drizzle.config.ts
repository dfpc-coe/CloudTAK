import type { Config } from "drizzle-kit";

export default {
    dialect: 'postgresql',
    schema: './lib/schema.ts',
    dbCredentials: {
        url: process.env.POSTGRES || 'postgres://postgres@localhost:5432/tak_ps_etl',
    },
    verbose: true,
    strict: true,
    out: './migrations'
} satisfies Config;
