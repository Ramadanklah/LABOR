#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkEnvironment() {
  log('🔍 Checking test environment...', 'blue');
  
  // Check if .env file exists
  if (!fs.existsSync('.env')) {
    log('❌ .env file not found! Creating a basic test environment...', 'red');
    
    const testEnv = `
# Test Environment Variables
NODE_ENV=test
JWT_SECRET=test_jwt_secret_please_override
DATABASE_URL=postgresql://test:test@localhost:5432/test_db
REDIS_URL=redis://localhost:6379/1
PORT=5001
FRONTEND_URL=http://localhost:3001
API_BASE_URL=http://localhost:5001
LOG_LEVEL=error
`;
    
    fs.writeFileSync('.env', testEnv.trim());
    log('✅ Created basic .env file for testing', 'green');
  }

  // Check Node.js version
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
    log(`📦 Node.js version: ${nodeVersion}`, 'cyan');
    
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion < 16) {
      log('⚠️  Warning: Node.js 16+ recommended for optimal testing', 'yellow');
    }
  } catch (error) {
    log('❌ Node.js not found', 'red');
    process.exit(1);
  }

  log('✅ Environment check complete', 'green');
}

function installDependencies() {
  log('📦 Installing dependencies...', 'blue');
  
  try {
    // Install server dependencies
    if (fs.existsSync('server/package.json')) {
      log('Installing server dependencies...', 'cyan');
      execSync('npm install', { 
        cwd: 'server', 
        stdio: 'inherit' 
      });
    }

    // Install client dependencies
    if (fs.existsSync('client/package.json')) {
      log('Installing client dependencies...', 'cyan');
      execSync('npm install', { 
        cwd: 'client', 
        stdio: 'inherit' 
      });
    }

    // Install root dependencies
    if (fs.existsSync('package.json')) {
      log('Installing root dependencies...', 'cyan');
      execSync('npm install', { stdio: 'inherit' });
    }

    log('✅ Dependencies installed successfully', 'green');
  } catch (error) {
    log('❌ Failed to install dependencies', 'red');
    log(error.message, 'red');
    process.exit(1);
  }
}

function runServerTests() {
  log('🧪 Running server tests...', 'blue');
  
  try {
    execSync('npm test', { 
      cwd: 'server', 
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'test' }
    });
    log('✅ Server tests completed successfully', 'green');
    return true;
  } catch (error) {
    log('❌ Server tests failed', 'red');
    return false;
  }
}

function runClientTests() {
  log('🧪 Running client tests...', 'blue');
  
  // Check if client has test script
  const clientPackageJson = path.join('client', 'package.json');
  if (!fs.existsSync(clientPackageJson)) {
    log('⚠️  No client package.json found, skipping client tests', 'yellow');
    return true;
  }

  const clientPackage = JSON.parse(fs.readFileSync(clientPackageJson, 'utf8'));
  if (!clientPackage.scripts || !clientPackage.scripts.test) {
    log('⚠️  No test script found in client package.json, skipping client tests', 'yellow');
    return true;
  }

  try {
    execSync('npm test', { 
      cwd: 'client', 
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'test', CI: 'true' }
    });
    log('✅ Client tests completed successfully', 'green');
    return true;
  } catch (error) {
    log('❌ Client tests failed', 'red');
    return false;
  }
}

function runIntegrationTests() {
  log('🧪 Running integration tests...', 'blue');
  
  if (!fs.existsSync('integration.test.js')) {
    log('⚠️  No integration tests found, skipping', 'yellow');
    return true;
  }

  try {
    execSync('npx jest integration.test.js --verbose', { 
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'test' }
    });
    log('✅ Integration tests completed successfully', 'green');
    return true;
  } catch (error) {
    log('❌ Integration tests failed', 'red');
    return false;
  }
}

function runE2ETests() {
  log('🧪 Running E2E tests...', 'blue');
  
  // Check for E2E test directories
  const e2eDirs = ['e2e', 'cypress', 'playwright', 'tests/e2e'];
  const existingE2EDir = e2eDirs.find(dir => fs.existsSync(dir));
  
  if (!existingE2EDir) {
    log('⚠️  No E2E tests found, skipping', 'yellow');
    return true;
  }

  try {
    if (existingE2EDir === 'cypress') {
      execSync('npx cypress run', { stdio: 'inherit' });
    } else if (existingE2EDir === 'playwright') {
      execSync('npx playwright test', { stdio: 'inherit' });
    } else {
      log('⚠️  E2E framework not recognized, skipping', 'yellow');
      return true;
    }
    
    log('✅ E2E tests completed successfully', 'green');
    return true;
  } catch (error) {
    log('❌ E2E tests failed', 'red');
    return false;
  }
}

function generateTestReport() {
  log('📊 Generating test report...', 'blue');
  
  const reportData = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'test',
    nodeVersion: process.version,
    testResults: {}
  };

  // Check for coverage reports
  const coverageFiles = [
    'server/coverage/lcov.info',
    'client/coverage/lcov.info',
    'coverage/lcov.info'
  ];

  coverageFiles.forEach(file => {
    if (fs.existsSync(file)) {
      reportData.coverage = reportData.coverage || {};
      reportData.coverage[path.dirname(file)] = file;
    }
  });

  // Write test report
  fs.writeFileSync('test-report.json', JSON.stringify(reportData, null, 2));
  log('✅ Test report generated: test-report.json', 'green');
}

function main() {
  const args = process.argv.slice(2);
  const options = {
    skipInstall: args.includes('--skip-install'),
    serverOnly: args.includes('--server-only'),
    clientOnly: args.includes('--client-only'),
    integrationOnly: args.includes('--integration-only'),
    e2eOnly: args.includes('--e2e-only'),
    verbose: args.includes('--verbose'),
    coverage: args.includes('--coverage')
  };

  log('🚀 Starting comprehensive test suite...', 'magenta');
  
  let allTestsPassed = true;
  const results = {};

  // Environment check
  checkEnvironment();

  // Install dependencies unless skipped
  if (!options.skipInstall) {
    installDependencies();
  }

  // Run specific test types based on options
  if (options.serverOnly || (!options.clientOnly && !options.integrationOnly && !options.e2eOnly)) {
    results.server = runServerTests();
    allTestsPassed = allTestsPassed && results.server;
  }

  if (options.clientOnly || (!options.serverOnly && !options.integrationOnly && !options.e2eOnly)) {
    results.client = runClientTests();
    allTestsPassed = allTestsPassed && results.client;
  }

  if (options.integrationOnly || (!options.serverOnly && !options.clientOnly && !options.e2eOnly)) {
    results.integration = runIntegrationTests();
    allTestsPassed = allTestsPassed && results.integration;
  }

  if (options.e2eOnly || (!options.serverOnly && !options.clientOnly && !options.integrationOnly)) {
    results.e2e = runE2ETests();
    allTestsPassed = allTestsPassed && results.e2e;
  }

  // Generate report
  generateTestReport();

  // Summary
  log('\n📋 Test Summary:', 'magenta');
  Object.entries(results).forEach(([type, passed]) => {
    const icon = passed ? '✅' : '❌';
    const color = passed ? 'green' : 'red';
    log(`${icon} ${type.charAt(0).toUpperCase() + type.slice(1)} tests: ${passed ? 'PASSED' : 'FAILED'}`, color);
  });

  if (allTestsPassed) {
    log('\n🎉 All tests passed successfully!', 'green');
    process.exit(0);
  } else {
    log('\n💥 Some tests failed. Check the output above for details.', 'red');
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log(`❌ Uncaught exception: ${error.message}`, 'red');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`❌ Unhandled rejection at: ${promise}, reason: ${reason}`, 'red');
  process.exit(1);
});

// Show help if requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🧪 Lab Results Test Runner

Usage: node run-tests.js [options]

Options:
  --skip-install     Skip dependency installation
  --server-only      Run only server tests
  --client-only      Run only client tests
  --integration-only Run only integration tests
  --e2e-only         Run only E2E tests
  --coverage         Generate coverage reports
  --verbose          Verbose output
  --help, -h         Show this help message

Examples:
  node run-tests.js                    # Run all tests
  node run-tests.js --server-only      # Run only server tests
  node run-tests.js --skip-install     # Skip dependency installation
  node run-tests.js --coverage         # Generate coverage reports
`);
  process.exit(0);
}

// Run the main function
main();