#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function validateTestSetup() {
  log('🔍 Validating test setup...', 'blue');
  
  const checks = [
    {
      name: 'Root package.json',
      path: 'package.json',
      required: true
    },
    {
      name: 'Server tests directory',
      path: 'server',
      required: true
    },
    {
      name: 'Client tests directory', 
      path: 'client',
      required: true
    },
    {
      name: 'Integration test file',
      path: 'integration.test.js',
      required: true
    },
    {
      name: 'E2E test file',
      path: 'e2e.test.js',
      required: true
    },
    {
      name: 'Test runner script',
      path: 'run-tests.js',
      required: true
    },
    {
      name: 'Server Jest config',
      path: 'server/jest.config.js',
      required: true
    },
    {
      name: 'Client Jest config',
      path: 'client/jest.config.cjs',
      required: true
    },
    {
      name: 'Server user management tests',
      path: 'server/user-management.test.js',
      required: true
    },
    {
      name: 'Server LDT processing tests',
      path: 'server/ldt-processing.test.js',
      required: true
    },
    {
      name: 'Client App component tests',
      path: 'client/src/components/App.test.jsx',
      required: true
    },
    {
      name: 'Client Login component tests',
      path: 'client/src/components/LoginPage.test.jsx',
      required: true
    },
    {
      name: 'Test documentation',
      path: 'TESTING.md',
      required: true
    }
  ];

  let allValid = true;
  let passedChecks = 0;

  checks.forEach(check => {
    const fullPath = path.join(__dirname, check.path);
    const exists = fs.existsSync(fullPath);
    
    if (exists) {
      log(`✅ ${check.name}`, 'green');
      passedChecks++;
    } else {
      log(`❌ ${check.name} - Missing: ${check.path}`, 'red');
      if (check.required) {
        allValid = false;
      }
    }
  });

  log('\n📊 Test Setup Summary:', 'cyan');
  log(`✅ Passed: ${passedChecks}/${checks.length}`, passedChecks === checks.length ? 'green' : 'yellow');
  
  if (allValid) {
    log('🎉 Test setup is complete and ready!', 'green');
    return true;
  } else {
    log('❌ Test setup has missing components', 'red');
    return false;
  }
}

// Test file content validation
function validateTestContent() {
  log('\n🔍 Validating test file content...', 'blue');
  
  const testFiles = [
    {
      path: 'server/user-management.test.js',
      requiredContent: ['describe', 'it', 'expect', 'UserModel', 'USER_ROLES']
    },
    {
      path: 'server/ldt-processing.test.js', 
      requiredContent: ['describe', 'it', 'expect', 'parseLDT', 'LDTGenerator']
    },
    {
      path: 'client/src/components/App.test.jsx',
      requiredContent: ['describe', 'it', 'expect', 'render', 'screen']
    },
    {
      path: 'integration.test.js',
      requiredContent: ['describe', 'it', 'expect', 'request', 'supertest']
    },
    {
      path: 'e2e.test.js',
      requiredContent: ['describe', 'it', 'expect', 'End-to-End', 'workflow']
    }
  ];

  let contentValid = true;

  testFiles.forEach(file => {
    const fullPath = path.join(__dirname, file.path);
    
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const missingContent = file.requiredContent.filter(required => 
        !content.includes(required)
      );
      
      if (missingContent.length === 0) {
        log(`✅ ${file.path} - Content valid`, 'green');
      } else {
        log(`⚠️  ${file.path} - Missing: ${missingContent.join(', ')}`, 'yellow');
        contentValid = false;
      }
    } else {
      log(`❌ ${file.path} - File not found`, 'red');
      contentValid = false;
    }
  });

  return contentValid;
}

// Package.json validation
function validatePackageJson() {
  log('\n🔍 Validating package.json configurations...', 'blue');
  
  const configs = [
    {
      path: 'package.json',
      requiredScripts: ['test', 'test:server', 'test:client', 'test:integration', 'test:e2e'],
      requiredDevDeps: ['jest', 'supertest']
    },
    {
      path: 'server/package.json',
      requiredScripts: ['test', 'test:watch', 'test:coverage'],
      requiredDevDeps: ['jest', 'supertest']
    },
    {
      path: 'client/package.json',
      requiredScripts: ['test', 'test:watch', 'test:coverage'],
      requiredDevDeps: ['jest', '@testing-library/react', '@testing-library/jest-dom']
    }
  ];

  let configValid = true;

  configs.forEach(config => {
    const fullPath = path.join(__dirname, config.path);
    
    if (fs.existsSync(fullPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        
        // Check scripts
        const missingScripts = config.requiredScripts.filter(script => 
          !packageJson.scripts || !packageJson.scripts[script]
        );
        
        // Check dev dependencies
        const missingDevDeps = config.requiredDevDeps.filter(dep => 
          !packageJson.devDependencies || !packageJson.devDependencies[dep]
        );
        
        if (missingScripts.length === 0 && missingDevDeps.length === 0) {
          log(`✅ ${config.path} - Configuration valid`, 'green');
        } else {
          if (missingScripts.length > 0) {
            log(`⚠️  ${config.path} - Missing scripts: ${missingScripts.join(', ')}`, 'yellow');
          }
          if (missingDevDeps.length > 0) {
            log(`⚠️  ${config.path} - Missing dev deps: ${missingDevDeps.join(', ')}`, 'yellow');
          }
          configValid = false;
        }
      } catch (error) {
        log(`❌ ${config.path} - Invalid JSON: ${error.message}`, 'red');
        configValid = false;
      }
    } else {
      log(`❌ ${config.path} - File not found`, 'red');
      configValid = false;
    }
  });

  return configValid;
}

// Test statistics
function generateTestStats() {
  log('\n📈 Test Statistics:', 'cyan');
  
  const testFiles = [
    'server/user-management.test.js',
    'server/ldt-processing.test.js', 
    'client/src/components/App.test.jsx',
    'client/src/components/LoginPage.test.jsx',
    'integration.test.js',
    'e2e.test.js'
  ];

  let totalTests = 0;
  let totalDescribeBlocks = 0;

  testFiles.forEach(filePath => {
    const fullPath = path.join(__dirname, filePath);
    
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Count test cases (it() blocks)
      const testCount = (content.match(/\s+it\s*\(/g) || []).length;
      
      // Count describe blocks
      const describeCount = (content.match(/\s+describe\s*\(/g) || []).length;
      
      totalTests += testCount;
      totalDescribeBlocks += describeCount;
      
      log(`📝 ${filePath}: ${testCount} tests in ${describeCount} suites`, 'reset');
    }
  });

  log(`\n📊 Total Test Coverage:`, 'cyan');
  log(`   📝 Test Files: ${testFiles.length}`, 'reset');
  log(`   🧪 Test Cases: ${totalTests}`, 'reset');
  log(`   📁 Test Suites: ${totalDescribeBlocks}`, 'reset');
  
  const categories = {
    'User Management': 'Authentication, authorization, user CRUD',
    'LDT Processing': 'File parsing, data validation, format conversion',
    'React Components': 'UI components, user interactions, form handling',
    'API Integration': 'Full workflow testing, database operations',
    'E2E Workflows': 'Complete user journeys, multi-role scenarios',
    'Security': 'Access control, data protection, compliance'
  };

  log(`\n🎯 Test Categories:`, 'cyan');
  Object.entries(categories).forEach(([category, description]) => {
    log(`   ${category}: ${description}`, 'reset');
  });
}

// Main validation function
function main() {
  log('🧪 Lab Results Test Suite Validation\n', 'cyan');
  
  const setupValid = validateTestSetup();
  const contentValid = validateTestContent();
  const configValid = validatePackageJson();
  
  generateTestStats();
  
  log('\n🏁 Final Results:', 'cyan');
  
  if (setupValid && contentValid && configValid) {
    log('🎉 Test suite is fully configured and ready to run!', 'green');
    log('\nNext steps:', 'cyan');
    log('1. Install dependencies: npm run install:all', 'reset');
    log('2. Run all tests: npm test', 'reset');
    log('3. Run specific tests: npm run test:server, test:client, etc.', 'reset');
    log('4. Check coverage: npm run test:coverage', 'reset');
    process.exit(0);
  } else {
    log('❌ Test suite configuration needs attention', 'red');
    log('\nPlease fix the issues above and run validation again.', 'yellow');
    process.exit(1);
  }
}

// Run validation
main();