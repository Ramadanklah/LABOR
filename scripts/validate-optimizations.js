#!/usr/bin/env node

/**
 * Validation script for production optimizations
 * Checks that all performance improvements are properly implemented
 */

const fs = require('fs');
const path = require('path');

class OptimizationValidator {
  constructor() {
    this.results = {
      frontend: [],
      backend: [],
      infrastructure: [],
      errors: []
    };
  }

  log(category, check, status, details = '') {
    const result = { check, status, details };
    this.results[category].push(result);
    
    const icon = status === 'pass' ? '✅' : status === 'warning' ? '⚠️' : '❌';
    console.log(`${icon} [${category.toUpperCase()}] ${check}${details ? ` - ${details}` : ''}`);
  }

  error(message) {
    this.results.errors.push(message);
    console.error(`❌ ERROR: ${message}`);
  }

  // Validate frontend optimizations
  validateFrontend() {
    console.log('\n🎯 Validating Frontend Optimizations...\n');

    // Check if build artifacts exist
    const distPath = path.join(__dirname, '..', 'client', 'dist');
    if (fs.existsSync(distPath)) {
      this.log('frontend', 'Production build created', 'pass');
      
      // Check for optimized assets
      const files = fs.readdirSync(distPath, { recursive: true });
      const jsFiles = files.filter(f => f.includes('.js'));
      const cssFiles = files.filter(f => f.includes('.css'));
      
      if (jsFiles.some(f => f.includes('vendor'))) {
        this.log('frontend', 'Vendor chunk separation', 'pass', 'vendor.js found');
      } else {
        this.log('frontend', 'Vendor chunk separation', 'fail', 'vendor.js not found');
      }

      if (jsFiles.some(f => f.includes('index'))) {
        this.log('frontend', 'Main app chunk', 'pass', 'index.js found');
      } else {
        this.log('frontend', 'Main app chunk', 'fail', 'index.js not found');
      }

      // Check file sizes
      const totalJSSize = jsFiles.reduce((total, file) => {
        const filePath = path.join(distPath, file);
        const stats = fs.statSync(filePath);
        return total + stats.size;
      }, 0);

      const totalJSSizeMB = (totalJSSize / 1024 / 1024).toFixed(2);
      if (totalJSSize < 500 * 1024) { // Less than 500KB
        this.log('frontend', 'JavaScript bundle size', 'pass', `${totalJSSizeMB}MB`);
      } else {
        this.log('frontend', 'JavaScript bundle size', 'warning', `${totalJSSizeMB}MB (consider further optimization)`);
      }

    } else {
      this.log('frontend', 'Production build', 'fail', 'dist folder not found');
    }

    // Check Vite configuration
    const viteConfigPath = path.join(__dirname, '..', 'client', 'vite.config.js');
    if (fs.existsSync(viteConfigPath)) {
      const viteConfig = fs.readFileSync(viteConfigPath, 'utf8');
      
      if (viteConfig.includes('manualChunks')) {
        this.log('frontend', 'Code splitting configured', 'pass');
      } else {
        this.log('frontend', 'Code splitting configured', 'fail');
      }

      if (viteConfig.includes('terser')) {
        this.log('frontend', 'Minification configured', 'pass');
      } else {
        this.log('frontend', 'Minification configured', 'fail');
      }

      if (viteConfig.includes('drop_console')) {
        this.log('frontend', 'Console removal for production', 'pass');
      } else {
        this.log('frontend', 'Console removal for production', 'fail');
      }
    }

    // Check for performance utilities
    const apiUtilPath = path.join(__dirname, '..', 'client', 'src', 'utils', 'api.js');
    if (fs.existsSync(apiUtilPath)) {
      const apiUtil = fs.readFileSync(apiUtilPath, 'utf8');
      
      if (apiUtil.includes('cache') && apiUtil.includes('retry')) {
        this.log('frontend', 'API client optimizations', 'pass', 'caching and retry logic');
      } else {
        this.log('frontend', 'API client optimizations', 'fail');
      }
    }

    const perfUtilPath = path.join(__dirname, '..', 'client', 'src', 'utils', 'performance.js');
    if (fs.existsSync(perfUtilPath)) {
      const perfUtil = fs.readFileSync(perfUtilPath, 'utf8');
      
      if (perfUtil.includes('PerformanceObserver') && perfUtil.includes('Core Web Vitals')) {
        this.log('frontend', 'Performance monitoring', 'pass', 'Core Web Vitals tracking');
      } else {
        this.log('frontend', 'Performance monitoring', 'fail');
      }
    }
  }

  // Validate backend optimizations
  validateBackend() {
    console.log('\n⚡ Validating Backend Optimizations...\n');

    // Check server.js optimizations
    const serverPath = path.join(__dirname, '..', 'server', 'server.js');
    if (fs.existsSync(serverPath)) {
      const serverCode = fs.readFileSync(serverPath, 'utf8');
      
      if (serverCode.includes('helmet')) {
        this.log('backend', 'Security headers (Helmet)', 'pass');
      } else {
        this.log('backend', 'Security headers (Helmet)', 'fail');
      }

      if (serverCode.includes('compression')) {
        this.log('backend', 'Response compression', 'pass');
      } else {
        this.log('backend', 'Response compression', 'fail');
      }

      if (serverCode.includes('rateLimit')) {
        this.log('backend', 'Rate limiting', 'pass');
      } else {
        this.log('backend', 'Rate limiting', 'fail');
      }

      if (serverCode.includes('NodeCache')) {
        this.log('backend', 'In-memory caching', 'pass');
      } else {
        this.log('backend', 'In-memory caching', 'fail');
      }

      if (serverCode.includes('winston')) {
        this.log('backend', 'Structured logging', 'pass');
      } else {
        this.log('backend', 'Structured logging', 'fail');
      }

      if (serverCode.includes('/api/health')) {
        this.log('backend', 'Health check endpoint', 'pass');
      } else {
        this.log('backend', 'Health check endpoint', 'fail');
      }

      if (serverCode.includes('asyncHandler')) {
        this.log('backend', 'Async error handling', 'pass');
      } else {
        this.log('backend', 'Async error handling', 'fail');
      }

    } else {
      this.error('server.js not found');
    }

    // Check package.json for optimized dependencies
    const serverPackagePath = path.join(__dirname, '..', 'server', 'package.json');
    if (fs.existsSync(serverPackagePath)) {
      const serverPackage = JSON.parse(fs.readFileSync(serverPackagePath, 'utf8'));
      
      const requiredDeps = ['compression', 'helmet', 'express-rate-limit', 'node-cache', 'winston'];
      const missingDeps = requiredDeps.filter(dep => !serverPackage.dependencies[dep]);
      
      if (missingDeps.length === 0) {
        this.log('backend', 'Performance dependencies', 'pass', 'all required packages present');
      } else {
        this.log('backend', 'Performance dependencies', 'fail', `missing: ${missingDeps.join(', ')}`);
      }
    }
  }

  // Validate infrastructure optimizations
  validateInfrastructure() {
    console.log('\n🐳 Validating Infrastructure Optimizations...\n');

    // Check Dockerfile
    const dockerfilePath = path.join(__dirname, '..', 'Dockerfile');
    if (fs.existsSync(dockerfilePath)) {
      const dockerfile = fs.readFileSync(dockerfilePath, 'utf8');
      
      if (dockerfile.includes('multi-stage') || dockerfile.includes('AS production')) {
        this.log('infrastructure', 'Multi-stage Docker build', 'pass');
      } else {
        this.log('infrastructure', 'Multi-stage Docker build', 'fail');
      }

      if (dockerfile.includes('alpine')) {
        this.log('infrastructure', 'Optimized base image', 'pass', 'Alpine Linux');
      } else {
        this.log('infrastructure', 'Optimized base image', 'warning', 'not using Alpine');
      }

      if (dockerfile.includes('HEALTHCHECK')) {
        this.log('infrastructure', 'Container health checks', 'pass');
      } else {
        this.log('infrastructure', 'Container health checks', 'fail');
      }

      if (dockerfile.includes('USER') && !dockerfile.includes('USER root')) {
        this.log('infrastructure', 'Non-root user execution', 'pass');
      } else {
        this.log('infrastructure', 'Non-root user execution', 'fail');
      }

    } else {
      this.log('infrastructure', 'Dockerfile', 'fail', 'not found');
    }

    // Check Docker Compose
    const dockerComposePath = path.join(__dirname, '..', 'docker-compose.prod.yml');
    if (fs.existsSync(dockerComposePath)) {
      const dockerCompose = fs.readFileSync(dockerComposePath, 'utf8');
      
      if (dockerCompose.includes('postgres')) {
        this.log('infrastructure', 'Database service', 'pass', 'PostgreSQL configured');
      } else {
        this.log('infrastructure', 'Database service', 'fail');
      }

      if (dockerCompose.includes('redis')) {
        this.log('infrastructure', 'Cache service', 'pass', 'Redis configured');
      } else {
        this.log('infrastructure', 'Cache service', 'fail');
      }

      if (dockerCompose.includes('nginx')) {
        this.log('infrastructure', 'Reverse proxy', 'pass', 'Nginx configured');
      } else {
        this.log('infrastructure', 'Reverse proxy', 'fail');
      }

      if (dockerCompose.includes('prometheus') && dockerCompose.includes('grafana')) {
        this.log('infrastructure', 'Monitoring stack', 'pass', 'Prometheus + Grafana');
      } else {
        this.log('infrastructure', 'Monitoring stack', 'fail');
      }

    } else {
      this.log('infrastructure', 'Production Docker Compose', 'fail', 'not found');
    }

    // Check environment configuration
    const envExamplePath = path.join(__dirname, '..', 'server', '.env.example');
    if (fs.existsSync(envExamplePath)) {
      const envExample = fs.readFileSync(envExamplePath, 'utf8');
      
      if (envExample.includes('NODE_ENV=production')) {
        this.log('infrastructure', 'Production environment config', 'pass');
      } else {
        this.log('infrastructure', 'Production environment config', 'fail');
      }

      if (envExample.includes('JWT_SECRET') && envExample.includes('DATABASE_URL')) {
        this.log('infrastructure', 'Security configuration', 'pass', 'JWT and DB config present');
      } else {
        this.log('infrastructure', 'Security configuration', 'fail');
      }

    } else {
      this.log('infrastructure', 'Environment configuration', 'fail', '.env.example not found');
    }
  }

  // Generate summary report
  generateReport() {
    console.log('\n📊 Optimization Validation Summary\n');
    console.log('=' * 50);
    
    const categories = ['frontend', 'backend', 'infrastructure'];
    let totalChecks = 0;
    let passedChecks = 0;
    let failedChecks = 0;
    let warnings = 0;

    categories.forEach(category => {
      const results = this.results[category];
      const passed = results.filter(r => r.status === 'pass').length;
      const failed = results.filter(r => r.status === 'fail').length;
      const warned = results.filter(r => r.status === 'warning').length;
      
      totalChecks += results.length;
      passedChecks += passed;
      failedChecks += failed;
      warnings += warned;

      const percentage = results.length > 0 ? Math.round((passed / results.length) * 100) : 0;
      
      console.log(`\n${category.toUpperCase()}: ${passed}/${results.length} checks passed (${percentage}%)`);
      
      if (failed > 0) {
        console.log(`  ❌ ${failed} failed checks`);
        results.filter(r => r.status === 'fail').forEach(r => {
          console.log(`     - ${r.check}${r.details ? ` (${r.details})` : ''}`);
        });
      }
      
      if (warned > 0) {
        console.log(`  ⚠️  ${warned} warnings`);
        results.filter(r => r.status === 'warning').forEach(r => {
          console.log(`     - ${r.check}${r.details ? ` (${r.details})` : ''}`);
        });
      }
    });

    console.log('\n' + '=' * 50);
    console.log(`\nOVERALL SCORE: ${passedChecks}/${totalChecks} optimizations implemented`);
    
    const overallPercentage = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;
    
    if (overallPercentage >= 90) {
      console.log('🚀 EXCELLENT: Your application is highly optimized!');
    } else if (overallPercentage >= 75) {
      console.log('✅ GOOD: Most optimizations are in place.');
    } else if (overallPercentage >= 50) {
      console.log('⚠️  FAIR: Some important optimizations are missing.');
    } else {
      console.log('❌ POOR: Many critical optimizations need to be implemented.');
    }

    if (this.results.errors.length > 0) {
      console.log('\n🔥 CRITICAL ERRORS:');
      this.results.errors.forEach(error => {
        console.log(`  - ${error}`);
      });
    }

    console.log('\n📖 For detailed optimization information, see:');
    console.log('   - PERFORMANCE_OPTIMIZATION_SUMMARY.md');
    console.log('   - README.md');
    
    return overallPercentage >= 75;
  }

  // Run all validations
  async validate() {
    console.log('🔍 Laboratory Results System - Performance Optimization Validator');
    console.log('=' * 60);
    
    try {
      this.validateFrontend();
      this.validateBackend();
      this.validateInfrastructure();
      
      const success = this.generateReport();
      
      if (success) {
        console.log('\n✅ Validation completed successfully!');
        process.exit(0);
      } else {
        console.log('\n❌ Validation failed. Please address the issues above.');
        process.exit(1);
      }
      
    } catch (error) {
      console.error('\n💥 Validation failed with error:', error.message);
      process.exit(1);
    }
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  const validator = new OptimizationValidator();
  validator.validate();
}

module.exports = OptimizationValidator;