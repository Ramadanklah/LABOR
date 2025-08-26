#!/usr/bin/env node

/**
 * Script to import existing LDT files into the application
 * This will process all .ldt files in the root directory and send them to the API
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000';
const LDT_FILES_DIR = __dirname; // Root directory where LDT files are located

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
        const response = await axios.post(`${API_BASE_URL}/api/mirth-webhook`, ldtContent, {
          headers: {
            'Content-Type': 'text/plain',
            'X-Webhook-Source': 'file-import'
          },
          timeout: 10000
        });

        if (response.status === 202 && response.data.success) {
          console.log(`✅ Successfully imported: ${fileName}`);
          console.log(`   Result ID: ${response.data.resultId}`);
          console.log(`   Message ID: ${response.data.messageId}`);
          successCount++;
        } else {
          console.log(`❌ Failed to import: ${fileName}`);
          console.log(`   Response: ${JSON.stringify(response.data)}`);
          errorCount++;
        }

      } catch (error) {
        console.log(`❌ Error processing ${path.basename(filePath)}:`);
        if (error.response) {
          console.log(`   Status: ${error.response.status}`);
          console.log(`   Message: ${error.response.data?.message || error.response.statusText}`);
        } else {
          console.log(`   Error: ${error.message}`);
        }
        errorCount++;
      }

      // Small delay between requests to avoid overwhelming the server
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
    const response = await axios.get(`${API_BASE_URL}/api/test`, { timeout: 5000 });
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
    console.log('❌ Server is not running or not accessible at ' + API_BASE_URL);
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