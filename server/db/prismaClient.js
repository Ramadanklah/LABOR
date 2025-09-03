/*
  Lightweight Prisma client wrapper using the Accelerate extension.
  This can be required from anywhere in the server codebase once
  models have been migrated from in-memory storage to a real database.
*/

const { PrismaClient } = require('@prisma/client');
const { withAccelerate } = require('@prisma/extension-accelerate');

// Extend the client with Accelerate for edge-optimised queries
const prisma = new PrismaClient().$extends(withAccelerate());

module.exports = prisma;