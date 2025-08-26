// Test environment variables
require('dotenv').config();
console.log('JWT_SECRET:', process.env.JWT_SECRET);
console.log('All environment variables:', process.env);