
import { neon } from '@neondatabase/serverless';

// Connect to the remote PostgreSQL database using the provided credentials.
const connectionString = 'postgresql://neondb_owner:npg_o5YcBDbpueE8@ep-dawn-river-a1yzfjdr-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

if (!connectionString) {
  throw new Error('Database connection string is not configured.');
}

// Export the sql instance for use in other API route files.
export const sql = neon(connectionString, {
  // Adding fetchOptions with keepalive can help resolve hanging connections in some serverless environments.
  fetchOptions: {
    keepalive: true,
  },
});
