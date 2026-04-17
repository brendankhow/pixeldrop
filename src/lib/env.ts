/**
 * Environment variable validation.
 * Throws a clear error at startup if any required variable is missing.
 */

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SENDGRID_API_KEY',
  'FROM_EMAIL',
  'NEXT_PUBLIC_SITE_URL',
] as const;

type RequiredEnvKey = (typeof required)[number];

function validateEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((k) => `  - ${k}`).join('\n')}\n\nCheck your .env.local file.`
    );
  }
}

// Run validation once at module load (server-side only)
if (typeof window === 'undefined') {
  validateEnv();
}

export function getEnv(key: RequiredEnvKey): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
}
