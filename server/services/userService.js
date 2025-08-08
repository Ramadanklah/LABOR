const prisma = require('../db/prismaClient');
const bcrypt = require('bcryptjs');

const DEFAULT_PAGE_SIZE = 25;

async function createUser(input) {
  const {
    email,
    password,
    firstName,
    lastName,
    role,
    bsnr,
    lanr,
    is2faEnabled,
    isActive,
  } = input;

  if (!email || !password || !firstName || !lastName || !role) {
    throw new Error('Missing required fields');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      role,
      bsnr,
      lanr,
      is2faEnabled: Boolean(is2faEnabled),
      isActive: isActive === undefined ? true : Boolean(isActive),
    },
  });

  return sanitize(user);
}

function sanitize(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

async function getUserByEmail(email) {
  if (!email) return null;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  return user ? sanitize(user) : null;
}

async function getUserById(id) {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? sanitize(user) : null;
}

async function getUserByIdRaw(id) {
  return prisma.user.findUnique({ where: { id } });
}

async function getUserByEmailRaw(email) {
  return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
}

async function getUserByBsnrLanr(bsnr, lanr) {
  if (!bsnr || !lanr) return null;
  const user = await prisma.user.findFirst({ where: { bsnr, lanr } });
  return user ? sanitize(user) : null;
}

async function updateUser(id, updates) {
  const data = { ...updates };

  if (data.password) {
    data.passwordHash = await bcrypt.hash(data.password, 12);
    delete data.password;
  }

  if (data.email) {
    data.email = data.email.toLowerCase();
  }

  const user = await prisma.user.update({
    where: { id },
    data,
  });
  return sanitize(user);
}

async function deleteUser(id) {
  await prisma.user.delete({ where: { id } });
  return true;
}

async function listUsers({ page = 1, pageSize = DEFAULT_PAGE_SIZE, filters = {} } = {}) {
  const where = buildWhere(filters);

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { total, users: users.map(sanitize), page, pageSize };
}

async function getAllUsers(filters = {}) {
  const where = buildWhere(filters);
  const users = await prisma.user.findMany({ where, orderBy: { createdAt: 'desc' } });
  return users.map(sanitize);
}

function buildWhere(filters) {
  const where = {};
  if (filters.role) where.role = filters.role;
  if (filters.isActive !== undefined) where.isActive = Boolean(filters.isActive);
  if (filters.search) {
    const term = filters.search;
    where.OR = [
      { firstName: { contains: term, mode: 'insensitive' } },
      { lastName: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
      { bsnr: { contains: term } },
      { lanr: { contains: term } },
    ];
  }
  return where;
}

async function getUserStats() {
  const [total, active, inactive, admins, doctors, labtechs, patients] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: false } }),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.user.count({ where: { role: 'DOCTOR' } }),
    prisma.user.count({ where: { role: 'LABTECH' } }),
    prisma.user.count({ where: { role: 'PATIENT' } }),
  ]);
  return {
    total,
    active,
    inactive,
    byRole: { ADMIN: admins, DOCTOR: doctors, LABTECH: labtechs, PATIENT: patients },
  };
}

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  updateUser,
  deleteUser,
  listUsers,
  getAllUsers,
  getUserByBsnrLanr,
  getUserStats,
  // internal helpers
  getUserByEmailRaw,
  getUserByIdRaw,
};