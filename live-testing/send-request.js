// node live-testing/send-request.js https://my-app-pranav-waikar.setu.helios-logic.com

// Traefik redirects HTTP → HTTPS. Node.js fetch follows the redirect but rejects
// the self-signed wildcard cert. This disables that check for this dev-only script.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const baseUrl = process.argv[2];

if (!baseUrl) {
  console.error("Error: Please provide a base URL as an argument.");
  console.error("Usage: node live-testing/send-request.js <url>");
  console.error("Example: node live-testing/send-request.js https://my-app-pranav-waikar.setu.helios-logic.com");
  process.exit(1);
}

// Ensure there is no trailing slash on baseUrl
const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
const targetUrl = `${cleanUrl}/listen`;

console.log(`Sending test requests to: ${targetUrl}\n`);

async function sendRequest(method, body = null) {
  const options = {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'X-Test-Header': `hello-from-${method.toLowerCase()}`
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(targetUrl, options);
    console.log(`▶ [${method}] Sent`);
    console.log(`◀ Status: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log(`◀ Response Body:`, JSON.stringify(data, null, 2));
    console.log(`----------------------------------------\n`);
  } catch (error) {
    console.error(`❌ Error sending ${method} request:`, error.message);
    if (error.cause) console.error(`   Cause:`, error.cause.message ?? error.cause);
    console.log(`----------------------------------------\n`);
  }
}

async function run() {
  // GET request
  await sendRequest('GET');

  // POST request
  await sendRequest('POST', { msg: "Testing POST request via Setu Tunnel" });

  // PUT request
  await sendRequest('PUT', { msg: "Testing PUT request via Setu Tunnel", updated: true });

  // DELETE request
  await sendRequest('DELETE');

  console.log("All test requests sent!");
}

run();
