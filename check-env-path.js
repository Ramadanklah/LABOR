// Check .env file path
const fs = require('fs');
const path = require('path');

console.log('Current working directory:', process.cwd());
console.log('.env file exists in current directory:', fs.existsSync('.env'));
console.log('Absolute path to .env:', path.resolve('.env'));
console.log('Content of .env file:');
try {
  const envContent = fs.readFileSync('.env', 'utf8');
  console.log(envContent);
} catch (error) {
  console.error('Error reading .env file:', error);
}