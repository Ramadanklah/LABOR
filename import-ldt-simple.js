#!/usr/bin/env node

/**
 * Simple LDT import script using built-in http module
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const API_HOST = 'localhost';
const API_PORT = 5002;
const LDT_FILES_DIR = __dirname;

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function importLDTFiles() {
  try {
    console.log('🔍 Scanning for LDT files...');
    
    // Find all .ldt files in the root directory
    const files = fs.readdirSync(LDT_FILES_DIR)
      .filter(file => file.endsWith('.ldt'))
      .map(file => path.join(LDT_FILES_DIR, file));

    if (files.length === 0) {
      console.log('❌ No LDT files found in the root directory');
      return;
    }

    console.log(`📁 Found ${files.length} LDT files:`);
    files.forEach(file => console.log(`   - ${path.basename(file)}`));

    console.log('\n🚀 Starting import process...');

    let successCount = 0;
    let errorCount = 0;

    for (const filePath of files) {
      try {
        const fileName = path.basename(filePath);
        console.log(`\n📤 Processing: ${fileName}`);

        // Read the LDT file content
        const ldtContent = fs.readFileSync(filePath, 'utf8');
        
        if (!ldtContent.trim()) {
          console.log(`⚠️  Skipping empty file: ${fileName}`);
          continue;
        }

        // Send to the API endpoint
        const response = await makeRequest({
          hostname: API_HOST,
          port: API_PORT,
          path: '/api/mirth-webhook',
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            'Content-Length': Buffer.byteLength(ldtContent),
            'X-Webhook-Source': 'file-import'
          }
        }, ldtContent);

        if (response.status === 202 && response.data.success) {
          console.log(`✅ Successfully imported: ${fileName}`);
          console.log(`   Result ID: ${response.data.resultId}`);
          console.log(`   Message ID: ${response.data.messageId}`);
          successCount++;
        } else {
          console.log(`❌ Failed to import: ${fileName}`);
          console.log(`   Status: ${response.status}`);
          console.log(`   Response: ${JSON.stringify(response.data)}`);
          errorCount++;
        }

      } catch (error) {
        console.log(`❌ Error processing ${path.basename(filePath)}:`);
        console.log(`   Error: ${error.message}`);
        errorCount++;
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n📊 Import Summary:');
    console.log(`   ✅ Successfully imported: ${successCount} files`);
    console.log(`   ❌ Failed to import: ${errorCount} files`);
    console.log(`   📁 Total processed: ${files.length} files`);

    if (successCount > 0) {
      console.log('\n🎉 Import completed! You should now see the results in your application.');
      console.log('   Visit: http://localhost:3002 to view the imported lab results.');
    }

  } catch (error) {
    console.error('💥 Fatal error during import:', error.message);
    process.exit(1);
  }
}

// Check if server is running
async function checkServerStatus() {
  try {
    const response = await makeRequest({
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/test',
      method: 'GET'
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

// Main execution
async function main() {
  console.log('🏥 Lab Results LDT File Import Tool');
  console.log('=====================================\n');

  // Check if server is running
  console.log('🔍 Checking server status...');
  const serverRunning = await checkServerStatus();
  
  if (!serverRunning) {
    console.log(`❌ Server is not running or not accessible at http://${API_HOST}:${API_PORT}`);
    console.log('   Please start the server first:');
    console.log('   cd server && npm start');
    process.exit(1);
  }

  console.log('✅ Server is running and accessible\n');

  await importLDTFiles();
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { importLDTFiles };