/*
  Lightweight Prisma client wrapper using the Accelerate extension.
  This can be required from anywhere in the server codebase once
  models have been migrated from in-memory storage to a real database.
*/

const path = require('path');
const modulePath = path.resolve(__dirname, '../../node_modules/@prisma/client');
const { PrismaClient } = require(modulePath);

const prisma = new PrismaClient();

module.exports = prisma;