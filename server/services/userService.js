const bcrypt = require('bcryptjs');
const prisma = require('../db/prismaClient');

const DEFAULT_PAGE_SIZE = 20;

function toPublicUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

async function createUser(input) {
  const {
    email,
    password,
    firstName,
    lastName,
    role,
    bsnr,
    lanr,
    isActive = true,
    is2faEnabled = false,
    twoFactorSecret = null,
  } = input;

  if (!email || !password || !firstName || !lastName || !role) {
    throw new Error('Missing required fields');
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) throw new Error('Email already exists');

  const passwordHash = await bcrypt.hash(password, 12);

  const created = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      role,
      bsnr: bsnr || null,
      lanr: lanr || null,
      isActive,
      is2faEnabled,
      twoFactorSecret,
    },
  });

  return toPublicUser(created);
}

async function getUserByEmail(email) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  return user;
}

async function getUserById(id) {
  const user = await prisma.user.findUnique({ where: { id } });
  return toPublicUser(user);
}

async function updateUser(id, updates) {
  const data = { ...updates };

  if (data.email) {
    data.email = data.email.toLowerCase();
  }

  if (data.password) {
    data.passwordHash = await bcrypt.hash(data.password, 12);
    delete data.password;
  }

  // Prevent direct writes to system-managed fields
  delete data.createdAt;
  delete data.updatedAt;
  delete data.lastLogin;

  const updated = await prisma.user.update({ where: { id }, data });
  return toPublicUser(updated);
}

async function deleteUser(id) {
  await prisma.user.delete({ where: { id } });
  return true;
}

async function listUsers({ page = 1, pageSize = DEFAULT_PAGE_SIZE, search, role, isActive } = {}) {
  const where = {};

  if (typeof isActive !== 'undefined' && isActive !== '') where.isActive = isActive === true || isActive === 'true';
  if (role) where.role = role;
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { bsnr: { contains: search } },
      { lanr: { contains: search } },
    ];
  }

  const skip = (Number(page) - 1) * Number(pageSize);
  const take = Number(pageSize);

  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
  ]);

  return {
    items: items.map(toPublicUser),
    total,
    page: Number(page),
    pageSize: Number(pageSize),
    pages: Math.ceil(total / take || 1),
  };
}

async function verifyPassword(user, password) {
  if (!user?.passwordHash) return false;
  return bcrypt.compare(password, user.passwordHash);
}

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  updateUser,
  deleteUser,
  listUsers,
  verifyPassword,
};