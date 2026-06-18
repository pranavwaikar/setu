// node live-testing/server.js

const http = require('http');

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/listen')) {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => {
      console.log(`\n========================================`);
      console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
      console.log(`Headers:`, JSON.stringify(req.headers, null, 2));
      console.log(`Body:`, body || '(empty)');
      console.log(`========================================`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        method: req.method,
        headers: req.headers,
        body: body
      }));
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(5000, () => {
  console.log('Test server listening on port 5000...');
  console.log('Endpoints: GET, POST, PUT, DELETE at http://localhost:5000/listen');
});
