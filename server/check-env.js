// Check environment variables in server directory
require('dotenv').config();
console.log('JWT_SECRET:', process.env.JWT_SECRET);
console.log('Current working directory:', process.cwd());