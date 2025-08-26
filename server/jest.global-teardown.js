module.exports = async () => {
  console.log('Tearing down test environment...');
  
  // Clean up any global resources
  // Close database connections, servers, etc.
  
  // Force close any remaining handles
  if (global.__SERVER__) {
    await new Promise((resolve) => {
      global.__SERVER__.close(resolve);
    });
  }
  
  console.log('Test environment teardown complete');
};