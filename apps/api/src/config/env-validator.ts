import { z } from 'zod';

const envSchema = z.object({
  // Core Environment
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.string().optional().default('3000'),

  // Security - Required
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().optional().default('7d'),

  // Redis - Optional (如果未設定，部分功能如通知排程將停用)
  REDIS_URL: z.string().url('REDIS_URL must be a valid URL').optional(),

  // External Services - Optional
  LINE_CHANNEL_ID: z.string().min(1).optional(),
  LINE_CHANNEL_SECRET: z.string().min(1).optional(),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().min(1).optional(),
  GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),

  // Storage & URLs
  FILE_STORAGE_PATH: z.string().optional().default('./uploads'),
  PUBLIC_APP_URL: z.string().url().optional(),

  // Cloudinary - Optional (如果未設定，圖片將存儲在本地檔案系統)
  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  try {
    const validated = envSchema.parse(process.env);
    console.log('✅ Environment variables validated successfully');

    // Log validation summary (without sensitive data)
    console.log('\n📋 Environment Configuration Summary:');
    console.log(`   - NODE_ENV: ${validated.NODE_ENV}`);
    console.log(`   - PORT: ${validated.PORT}`);
    console.log(`   - DATABASE_URL: ${validated.DATABASE_URL ? '✓ Configured' : '✗ Missing'}`);
    console.log(`   - REDIS_URL: ${validated.REDIS_URL ? '✓ Configured' : '○ Not configured (optional)'}`);
    console.log(`   - SESSION_SECRET: ${validated.SESSION_SECRET.length >= 32 ? '✓ Valid' : '✗ Too short'}`);
    console.log(`   - JWT_SECRET: ${validated.JWT_SECRET.length >= 32 ? '✓ Valid' : '✗ Too short'}`);
    console.log(`   - JWT_EXPIRES_IN: ${validated.JWT_EXPIRES_IN}`);
    console.log(`   - LINE Integration: ${validated.LINE_CHANNEL_ACCESS_TOKEN ? '✓ Enabled' : '○ Disabled'}`);
    console.log(`   - Google Maps API: ${validated.GOOGLE_MAPS_API_KEY ? '✓ Enabled' : '○ Disabled'}`);
    console.log(`   - FILE_STORAGE_PATH: ${validated.FILE_STORAGE_PATH}`);
    console.log(`   - Cloudinary: ${validated.CLOUDINARY_CLOUD_NAME ? '✓ Enabled' : '○ Disabled (using local storage)'}`);
    console.log('');

    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('\n❌ Invalid environment variables:');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      error.errors.forEach(err => {
        console.error(`  ✗ ${err.path.join('.')}: ${err.message}`);
      });
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('\n💡 Please check your .env file and ensure all required variables are set.');
      console.error('   Reference: .env.example\n');
    } else {
      console.error('\n❌ Unexpected error during environment validation:', error);
    }
    process.exit(1);
  }
}
