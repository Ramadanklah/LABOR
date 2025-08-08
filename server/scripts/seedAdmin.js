require('dotenv').config();
const prisma = require('../db/prismaClient');
const bcrypt = require('bcryptjs');

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const firstName = process.env.SEED_ADMIN_FIRST_NAME || 'System';
  const lastName = process.env.SEED_ADMIN_LAST_NAME || 'Administrator';

  if (!email || !password) {
    console.error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    console.log('Admin already exists. Skipping.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      role: 'ADMIN',
      is2faEnabled: false,
    },
  });

  console.log('Admin user created:', email);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });