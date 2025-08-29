## CloudTAK v11.0.0 Migration Guide

- Perform a backup of your current CloudTAK instance including the S3 `profile/` directory before proceeding with the migration.
- Deploy v11.0.0 using your preferred method
- Install the migration script dependencies by running:

```bash
npm install
```

- Ensure you have AWS credentials configured in your environment.
- Run the migration script:

```bash
npx tsx index.ts <s3 bucket>
```

- Apply the resultant `migration.sql` output to your database.
