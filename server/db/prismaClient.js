/*
  Lightweight Prisma client wrapper.
*/

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;