package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/hashicorp/yamux"
)

// wsConn wraps a websocket.Conn to implement the net.Conn interface for Yamux.
type wsConn struct {
	*websocket.Conn
	reader io.Reader
}

func newWSConn(ws *websocket.Conn) *wsConn {
	return &wsConn{Conn: ws}
}

func (c *wsConn) Read(p []byte) (n int, err error) {
	for {
		if c.reader == nil {
			messageType, r, err := c.NextReader()
			if err != nil {
				return 0, err
			}
			if messageType != websocket.BinaryMessage {
				continue // skip non-binary messages
			}
			c.reader = r
		}
		n, err = c.reader.Read(p)
		if err == io.EOF {
			c.reader = nil
			if n > 0 {
				return n, nil
			}
			continue
		}
		return n, err
	}
}

func (c *wsConn) Write(p []byte) (n int, err error) {
	err = c.WriteMessage(websocket.BinaryMessage, p)
	if err != nil {
		return 0, err
	}
	return len(p), nil
}

func (c *wsConn) Close() error {
	return c.Conn.Close()
}

func (c *wsConn) LocalAddr() net.Addr {
	return c.Conn.LocalAddr()
}

func (c *wsConn) RemoteAddr() net.Addr {
	return c.Conn.RemoteAddr()
}

func (c *wsConn) SetDeadline(t time.Time) error {
	return c.Conn.UnderlyingConn().SetDeadline(t)
}

func (c *wsConn) SetReadDeadline(t time.Time) error {
	return c.Conn.SetReadDeadline(t)
}

func (c *wsConn) SetWriteDeadline(t time.Time) error {
	return c.Conn.SetWriteDeadline(t)
}

// Registry maps active subdomains to their corresponding Yamux sessions.
type Registry struct {
	mu         sync.RWMutex
	tunnels    map[string]*yamux.Session
	tunnelIds  map[string]string
	tunnelAuth map[string]string
}

func NewRegistry() *Registry {
	return &Registry{
		tunnels:    make(map[string]*yamux.Session),
		tunnelIds:  make(map[string]string),
		tunnelAuth: make(map[string]string),
	}
}

// mustParseURL parses a URL string and panics on error (used for static config values).
func mustParseURL(raw string) *url.URL {
	u, err := url.Parse(raw)
	if err != nil {
		panic(fmt.Sprintf("invalid URL %q: %v", raw, err))
	}
	return u
}

func (r *Registry) Register(subdomain string, session *yamux.Session, tunnelId string, authCreds string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	// If there's an existing session, close it.
	if oldSession, exists := r.tunnels[subdomain]; exists {
		oldSession.Close()
	}

	r.tunnels[subdomain] = session
	r.tunnelIds[subdomain] = tunnelId
	if authCreds != "" {
		r.tunnelAuth[subdomain] = authCreds
	} else {
		delete(r.tunnelAuth, subdomain)
	}
}

func (r *Registry) Unregister(subdomain string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.tunnels, subdomain)
	delete(r.tunnelIds, subdomain)
	delete(r.tunnelAuth, subdomain)
}

func (r *Registry) Get(subdomain string) (*yamux.Session, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	session, exists := r.tunnels[subdomain]
	return session, exists
}

type Gateway struct {
	registry     *Registry
	upgrader     websocket.Upgrader
	apiServerURL string
	gatewayToken string
	tunnelDomain string
	dashboardURL string
}

type AuthRequest struct {
	ApiKey    string `json:"apiKey"`
	Subdomain string `json:"subdomain"`
	LocalPort int    `json:"localPort"`
}

type AuthResponse struct {
	Success  bool   `json:"success"`
	TunnelId string `json:"tunnelId"`
	Hostname string `json:"hostname"`
	Email    string `json:"email"`
}

var reservedSubdomains = map[string]bool{
	"admin":     true,
	"api":       true,
	"root":      true,
	"support":   true,
	"www":       true,
	"mail":      true,
	"dns":       true,
	"gateway":   true,
	"dashboard": true,
	"helios":    true,
	"setu":      true,
	"auth":      true,
	"status":    true,
	"docs":      true,
}

func isReservedSubdomain(subdomain string) bool {
	return reservedSubdomains[strings.ToLower(subdomain)]
}

// resolveSubdomainFromHost parses the host header and determines which subdomain it represents.
// In the future, this can be expanded to check database mappings for custom domains.
func (g *Gateway) resolveSubdomainFromHost(host string) (string, bool) {
	suffix := "." + g.tunnelDomain
	if strings.HasSuffix(host, suffix) {
		subdomain := strings.TrimSuffix(host, suffix)
		return subdomain, true
	}
	// Future custom domain lookup logic:
	// dbTunnelSubdomain, exists := lookupCustomDomainInDB(host)
	// if exists { return dbTunnelSubdomain, true }
	return "", false
}

func main() {
	// Internal upstream targets — set by docker-compose / Coolify env vars.
	apiServerURL := os.Getenv("API_SERVER_URL")
	if apiServerURL == "" {
		apiServerURL = os.Getenv("INTERNAL_API_URL")
	}
	if apiServerURL == "" {
		apiServerURL = "http://api:4000"
	}
	dashboardURL := os.Getenv("DASHBOARD_URL")
	if dashboardURL == "" {
		dashboardURL = "http://dashboard:3000"
	}
	gatewayToken := os.Getenv("GATEWAY_API_TOKEN")
	if gatewayToken == "" {
		gatewayToken = "default-gateway-secret"
	}
	tunnelDomain := os.Getenv("TUNNEL_DOMAIN")
	if tunnelDomain == "" {
		tunnelDomain = "setu.helios-logic.com"
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	gw := &Gateway{
		registry: NewRegistry(),
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow all CLI connections
			},
		},
		apiServerURL: apiServerURL,
		gatewayToken: gatewayToken,
		tunnelDomain: tunnelDomain,
		dashboardURL: dashboardURL,
	}

	mux := http.NewServeMux()

	// ── Routing table (longest-prefix match wins) ─────────────────────────────
	// 1. Tunnel WebSocket control-plane (CLI ↔ gateway)
	mux.HandleFunc("/tunnel/connect", gw.handleTunnelConnect)
	// 2. Gateway health check
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})
	// 3. API service — strip /api prefix before forwarding to NestJS
	mux.Handle("/api/", gw.apiProxy())
	// 4. Everything else → Next.js dashboard (catches / and all dashboard routes)
	mux.Handle("/", gw.dashboardProxy())

	// Dispatch wildcard tunnel subdomain requests to handlePublicTraffic, and standard paths to mux.
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Block public access to internal endpoints
		cleanedPath := path.Clean(r.URL.Path)
		normalizedPath := strings.ToLower(cleanedPath)
		if strings.HasPrefix(normalizedPath, "/api/internal/") || strings.HasPrefix(normalizedPath, "/internal/") || strings.Contains(normalizedPath, "/internal/") {
			http.Error(w, "Access Denied: Internal endpoint", http.StatusForbidden)
			return
		}

		host := r.Host
		if strings.Contains(host, ":") {
			h, _, err := net.SplitHostPort(host)
			if err == nil {
				host = h
			}
		}

		// 1. Resolve subdomain (handles standard wildcard subdomain or future custom domains)
		subdomain, isSubdomain := gw.resolveSubdomainFromHost(host)

		if isSubdomain {
			// Check if subdomain is a reserved word
			if isReservedSubdomain(subdomain) {
				http.NotFound(w, r)
				return
			}
			gw.handlePublicTraffic(w, r)
			return
		}

		// 2. If it's the exact control plane root, or localhost/127.0.0.1, route standard paths via mux
		if host == gw.tunnelDomain || host == "localhost" || host == "127.0.0.1" {
			mux.ServeHTTP(w, r)
			return
		}

		// 3. Fallback for unrecognized hosts
		http.NotFound(w, r)
	})

	server := &http.Server{
		Addr:    ":" + port,
		Handler: handler,
	}

	log.Printf("Gateway listening on port %s", port)
	log.Printf("  /api/*  → %s", apiServerURL)
	log.Printf("  /*      → %s", dashboardURL)
	log.Printf("  tunnel domain: .%s", tunnelDomain)

	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Server exited with error: %v", err)
	}
}

// handleTunnelConnect handles WebSocket upgrades from the CLI client.
func (g *Gateway) handleTunnelConnect(w http.ResponseWriter, r *http.Request) {
	apiKey := r.Header.Get("X-API-Key")
	subdomain := r.URL.Query().Get("subdomain")
	localPortStr := r.URL.Query().Get("port")
	authCreds := r.URL.Query().Get("auth")

	if apiKey == "" || subdomain == "" || localPortStr == "" {
		http.Error(w, "Missing authentication or connection details", http.StatusBadRequest)
		return
	}

	var localPort int
	if _, err := fmt.Sscanf(localPortStr, "%d", &localPort); err != nil {
		http.Error(w, "Invalid port number", http.StatusBadRequest)
		return
	}

	log.Printf("[CLI Connect] API Key: %s..., Subdomain: %s, Local Port: %d", apiKey[:Min(len(apiKey), 8)], subdomain, localPort)

	// 1. Authenticate with NextJS API
	authResp, err := g.authenticateWithAPI(apiKey, subdomain, localPort)
	if err != nil {
		log.Printf("[CLI Auth Failed] Error: %v", err)
		http.Error(w, "Authentication failed: "+err.Error(), http.StatusUnauthorized)
		return
	}

	// 2. Upgrade to WebSocket
	conn, err := g.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[CLI Upgrade Failed] Error: %v", err)
		return
	}

	tunnelType := r.URL.Query().Get("type")
	var tcpPort int
	var tcpListener net.Listener
	if tunnelType == "tcp" {
		tcpListener, err = net.Listen("tcp", ":0")
		if err != nil {
			log.Printf("[TCP Listen Failed] %v", err)
			_ = conn.WriteJSON(map[string]string{"error": "Failed to allocate TCP port"})
			conn.Close()
			return
		}
		tcpPort = tcpListener.Addr().(*net.TCPAddr).Port
		err = conn.WriteJSON(map[string]interface{}{"status": "ok", "tcp_port": tcpPort})
		if err != nil {
			tcpListener.Close()
			conn.Close()
			return
		}
	} else {
		err = conn.WriteJSON(map[string]interface{}{"status": "ok"})
		if err != nil {
			conn.Close()
			return
		}
	}

	// Wrap WebSocket to satisfy net.Conn
	netConn := newWSConn(conn)

	// 3. Initialize Yamux Server
	yamuxConfig := yamux.DefaultConfig()
	yamuxConfig.KeepAliveInterval = 15 * time.Second
	yamuxConfig.ConnectionWriteTimeout = 10 * time.Second

	session, err := yamux.Server(netConn, yamuxConfig)
	if err != nil {
		log.Printf("[Yamux Init Failed] Error: %v", err)
		if tcpListener != nil {
			tcpListener.Close()
		}
		conn.Close()
		return
	}

	// 4. Register Session in Registry
	g.registry.Register(authResp.Hostname, session, authResp.TunnelId, authCreds)
	log.Printf("[CLI Connected] Subdomain: %s -> Tunnel ID: %s", authResp.Hostname, authResp.TunnelId)

	if tunnelType == "tcp" {
		log.Printf("[TCP Tunnel] Listening on port %d -> forwarding to subdomain %s", tcpPort, authResp.Hostname)
		go func() {
			defer tcpListener.Close()
			
			go func() {
				<-session.CloseChan()
				tcpListener.Close()
			}()

			for {
				clientConn, err := tcpListener.Accept()
				if err != nil {
					return
				}

				stream, err := session.Open()
				if err != nil {
					clientConn.Close()
					log.Printf("[TCP Proxy Error] Failed to open Yamux stream: %v", err)
					continue
				}

				go func(c net.Conn, s net.Conn) {
					defer c.Close()
					defer s.Close()
					errChan := make(chan error, 2)
					go func() {
						_, err := io.Copy(s, c)
						errChan <- err
					}()
					go func() {
						_, err := io.Copy(c, s)
						errChan <- err
					}()
					<-errChan
				}(clientConn, stream)
			}
		}()
	}

	// 5. Handle cleanup when session ends
	go func() {
		<-session.CloseChan()
		g.registry.Unregister(authResp.Hostname)
		g.notifyDisconnect(authResp.TunnelId)
		log.Printf("[CLI Disconnected] Subdomain: %s -> Tunnel ID: %s", authResp.Hostname, authResp.TunnelId)
	}()
}

// apiProxy returns an http.Handler that strips the /api prefix and reverse-proxies
// the request to the internal NestJS API service.
func (g *Gateway) apiProxy() http.Handler {
	target := mustParseURL(g.apiServerURL)
	proxy := httputil.NewSingleHostReverseProxy(target)

	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		// Strip /api prefix — NestJS expects /auth/login not /api/auth/login
		req.URL.Path = strings.TrimPrefix(req.URL.Path, "/api")
		if req.URL.Path == "" {
			req.URL.Path = "/"
		}
		req.URL.RawPath = strings.TrimPrefix(req.URL.RawPath, "/api")
		req.Header.Set("X-Forwarded-Host", req.Host)
		req.Header.Set("X-Forwarded-Proto", "https")
		req.Header.Del("X-Gateway-Secret")
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("[API Proxy Error] %s %s: %v", r.Method, r.URL.Path, err)
		w.WriteHeader(http.StatusBadGateway)
		fmt.Fprintf(w, `{"error":"api unavailable","detail":%q}`, err.Error())
	}
	return proxy
}

// dashboardProxy returns an http.Handler that reverse-proxies all remaining
// requests to the internal Next.js dashboard service.
func (g *Gateway) dashboardProxy() http.Handler {
	target := mustParseURL(g.dashboardURL)
	proxy := httputil.NewSingleHostReverseProxy(target)

	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Header.Set("X-Forwarded-Host", req.Host)
		req.Header.Set("X-Forwarded-Proto", "https")
		req.Header.Del("X-Gateway-Secret")
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("[Dashboard Proxy Error] %s %s: %v", r.Method, r.URL.Path, err)
		w.WriteHeader(http.StatusBadGateway)
		fmt.Fprintf(w, "Dashboard unavailable: %v", err)
	}
	return proxy
}

// handlePublicTraffic handles wildcard-subdomain tunnel traffic (e.g. abc.free.dev.setu.com).
// Root-domain traffic is handled by dashboardProxy / apiProxy above.
func (g *Gateway) handlePublicTraffic(w http.ResponseWriter, r *http.Request) {
	host := r.Host
	// Remove port from host if present
	if strings.Contains(host, ":") {
		h, _, err := net.SplitHostPort(host)
		if err == nil {
			host = h
		}
	}

	// Identify subdomain: abc.free.dev.setu.com → "abc"
	suffix := "." + g.tunnelDomain
	if !strings.HasSuffix(host, suffix) {
		// Not a tunnel subdomain — should not reach here since /api/ and / are
		// handled before this, but guard just in case.
		http.NotFound(w, r)
		return
	}
	subdomain := strings.TrimSuffix(host, suffix)

	session, ok := g.registry.Get(subdomain)
	if !ok {
		g.showTunnelOffline(w, subdomain)
		return
	}

	// Edge Protection (Basic Auth check)
	g.registry.mu.RLock()
	authCreds, hasAuth := g.registry.tunnelAuth[subdomain]
	g.registry.mu.RUnlock()

	if hasAuth && authCreds != "" {
		username, password, ok := r.BasicAuth()
		expectedParts := strings.SplitN(authCreds, ":", 2)
		if !ok || len(expectedParts) != 2 || username != expectedParts[0] || password != expectedParts[1] {
			w.Header().Set("WWW-Authenticate", `Basic realm="Setu Private Tunnel"`)
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
	}

	// Reverse-proxy through the Yamux session to the CLI client's local server.
	director := func(req *http.Request) {
		req.URL.Scheme = "http"
		req.URL.Host = "127.0.0.1"
		req.Header.Set("X-Forwarded-Host", r.Host)
		req.Header.Set("X-Forwarded-Proto", "https")
	}

	proxy := &httputil.ReverseProxy{
		Director: director,
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
				return session.Open()
			},
		},
		ErrorLog: log.New(io.Discard, "", 0),
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			log.Printf("[Tunnel Proxy Error] %s -> %v", subdomain, err)
			w.WriteHeader(http.StatusBadGateway)
			fmt.Fprintf(w, "Setu Gateway Proxy Error: %v", err)
		},
	}

	proxy.ServeHTTP(w, r)
}

func (g *Gateway) authenticateWithAPI(apiKey, subdomain string, localPort int) (*AuthResponse, error) {
	reqBody, err := json.Marshal(AuthRequest{
		ApiKey:    apiKey,
		Subdomain: subdomain,
		LocalPort: localPort,
	})
	if err != nil {
		return nil, err
	}

	client := &http.Client{Timeout: 5 * time.Second}
	req, err := http.NewRequest("POST", g.apiServerURL+"/internal/gateway/auth", bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Gateway-Secret", g.gatewayToken)

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		var errData map[string]interface{}
		_ = json.NewDecoder(resp.Body).Decode(&errData)
		if msg, ok := errData["message"].(string); ok {
			return nil, fmt.Errorf(msg)
		}
		return nil, fmt.Errorf("API auth returned status code %d", resp.StatusCode)
	}

	var authResp AuthResponse
	if err := json.NewDecoder(resp.Body).Decode(&authResp); err != nil {
		return nil, err
	}

	return &authResp, nil
}

func (g *Gateway) notifyDisconnect(tunnelId string) {
	reqBody, err := json.Marshal(map[string]string{
		"tunnelId": tunnelId,
	})
	if err != nil {
		log.Printf("[Disconnect Error] failed to marshal: %v", err)
		return
	}

	client := &http.Client{Timeout: 5 * time.Second}
	req, err := http.NewRequest("POST", g.apiServerURL+"/internal/gateway/disconnect", bytes.NewBuffer(reqBody))
	if err != nil {
		log.Printf("[Disconnect Error] failed to create request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Gateway-Secret", g.gatewayToken)

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[Disconnect Callback Failed] %v", err)
		return
	}
	defer resp.Body.Close()
}

func (g *Gateway) showTunnelOffline(w http.ResponseWriter, subdomain string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusNotFound)
	w.Write([]byte(fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
    <title>Tunnel Offline</title>
    <style>
        body { background: #09090b; color: #fafafa; font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .card { background: rgba(255,255,255,0.05); padding: 2rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); text-align: center; max-width: 450px; box-shadow: 0 4px 30px rgba(0,0,0,0.5); }
        h1 { margin: 0; font-size: 1.8rem; color: #f43f5e; }
        p { color: #a1a1aa; font-size: 0.9rem; margin-top: 1rem; }
        code { background: #18181b; padding: 0.2rem 0.4rem; border-radius: 4px; color: #e4e4e7; font-family: monospace; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Tunnel Offline</h1>
        <p>The subdomain <code>%s</code> does not have an active tunnel session connected.</p>
        <p style="font-size: 0.8rem; color: #71717a;">Start your CLI client exposing this subdomain to establish a connection.</p>
    </div>
</body>
</html>`, subdomain)))
}

func Min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
