const http = require('http');

function testLocalServer() {
  return new Promise((resolve) => {
    console.log('Testing connection to localhost:3000...');
    
    const req = http.get('http://localhost:3000', (res) => {
      console.log(`Status code: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Response received');
        console.log(`Data length: ${data.length} bytes`);
        resolve(true);
      });
    });
    
    req.on('error', (error) => {
      console.error(`Error connecting to server: ${error.message}`);
      resolve(false);
    });
    
    req.setTimeout(10000, () => {
      console.log('Request timed out after 10 seconds');
      req.destroy();
      resolve(false);
    });
  });
}

testLocalServer()
  .then((success) => {
    console.log(`Test ${success ? 'succeeded' : 'failed'}`);
  });