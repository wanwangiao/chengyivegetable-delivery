import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createTestDriver() {
  const testPhone = '0912345678';
  const testPassword = 'test123';
  const testEmail = 'driver@test.com';
  const testName = '測試外送員';

  try {
    // Check if driver already exists
    const existingDriver = await prisma.driver.findFirst({
      where: { phone: testPhone }
    });

    if (existingDriver) {
      console.log('測試外送員已存在:', existingDriver);
      return;
    }

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { email: testEmail }
    });

    if (!user) {
      // Create user
      const hashedPassword = await bcrypt.hash(testPassword, 10);
      user = await prisma.user.create({
        data: {
          email: testEmail,
          password: hashedPassword,
          name: testName,
          role: 'DRIVER',
          isActive: true
        }
      });
      console.log('建立使用者:', user);
    }

    // Create driver profile
    const driver = await prisma.driver.create({
      data: {
        id: user.id,
        name: testName,
        phone: testPhone,
        status: 'available'
      }
    });

    console.log('建立測試外送員成功!');
    console.log('手機號碼:', testPhone);
    console.log('密碼:', testPassword);
    console.log('Driver:', driver);
  } catch (error) {
    console.error('建立測試外送員失敗:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestDriver();
