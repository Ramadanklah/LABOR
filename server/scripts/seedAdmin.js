#!/usr/bin/env node
require('dotenv').config();
const readline = require('readline');
const userService = require('../services/userService');

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

(async function main() {
  try {
    const email = process.env.SEED_ADMIN_EMAIL || await prompt('Admin email: ');
    const password = process.env.SEED_ADMIN_PASSWORD || await prompt('Admin password: ');
    const firstName = process.env.SEED_ADMIN_FIRST || 'System';
    const lastName = process.env.SEED_ADMIN_LAST || 'Administrator';

    if (!email || !password) {
      console.error('Email and password are required');
      process.exit(1);
    }

    const admin = await userService.createUser({
      email,
      password,
      firstName,
      lastName,
      role: 'ADMIN',
      isActive: true,
    });

    console.log('Admin user created:', admin.email, admin.id);
    process.exit(0);
  } catch (err) {
    if (err.message && err.message.includes('Email already exists')) {
      console.log('Admin already exists. Skipping.');
      process.exit(0);
    }
    console.error('Seed failed:', err);
    process.exit(1);
  }
})();