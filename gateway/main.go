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
	"os"
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
	mu        sync.RWMutex
	tunnels   map[string]*yamux.Session
	tunnelIds map[string]string
}

func NewRegistry() *Registry {
	return &Registry{
		tunnels:   make(map[string]*yamux.Session),
		tunnelIds: make(map[string]string),
	}
}

func (r *Registry) Register(subdomain string, session *yamux.Session, tunnelId string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	// If there's an existing session, close it.
	if oldSession, exists := r.tunnels[subdomain]; exists {
		oldSession.Close()
	}

	r.tunnels[subdomain] = session
	r.tunnelIds[subdomain] = tunnelId
}

func (r *Registry) Unregister(subdomain string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.tunnels, subdomain)
	delete(r.tunnelIds, subdomain)
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

func main() {
	apiServerURL := os.Getenv("API_SERVER_URL")
	if apiServerURL == "" {
		apiServerURL = "http://127.0.0.1:4000"
	}
	gatewayToken := os.Getenv("GATEWAY_API_TOKEN")
	if gatewayToken == "" {
		gatewayToken = "default-gateway-secret"
	}
	tunnelDomain := os.Getenv("TUNNEL_DOMAIN")
	if tunnelDomain == "" {
		tunnelDomain = "free.dev.setu.com"
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
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/tunnel/connect", gw.handleTunnelConnect)
	mux.HandleFunc("/", gw.handlePublicTraffic)

	server := &http.Server{
		Addr:    ":" + port,
		Handler: mux,
	}

	log.Printf("Gateway server is running on port %s", port)
	log.Printf("Routing target suffix: .%s", tunnelDomain)
	log.Printf("API server target: %s", apiServerURL)

	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Server exited with error: %v", err)
	}
}

// handleTunnelConnect handles WebSocket upgrades from the CLI client.
func (g *Gateway) handleTunnelConnect(w http.ResponseWriter, r *http.Request) {
	apiKey := r.Header.Get("X-API-Key")
	subdomain := r.URL.Query().Get("subdomain")
	localPortStr := r.URL.Query().Get("port")

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

	// Wrap WebSocket to satisfy net.Conn
	netConn := newWSConn(conn)

	// 3. Initialize Yamux Server
	yamuxConfig := yamux.DefaultConfig()
	yamuxConfig.KeepAliveInterval = 15 * time.Second
	yamuxConfig.ConnectionWriteTimeout = 10 * time.Second

	session, err := yamux.Server(netConn, yamuxConfig)
	if err != nil {
		log.Printf("[Yamux Init Failed] Error: %v", err)
		conn.Close()
		return
	}

	// 4. Register Session in Registry
	g.registry.Register(authResp.Hostname, session, authResp.TunnelId)
	log.Printf("[CLI Connected] Subdomain: %s -> Tunnel ID: %s", authResp.Hostname, authResp.TunnelId)

	// 5. Handle cleanup when session ends
	go func() {
		<-session.CloseChan()
		g.registry.Unregister(authResp.Hostname)
		g.notifyDisconnect(authResp.TunnelId)
		log.Printf("[CLI Disconnected] Subdomain: %s -> Tunnel ID: %s", authResp.Hostname, authResp.TunnelId)
	}()
}

// handlePublicTraffic proxies wildcard subdomain HTTP requests to their corresponding Yamux streams.
func (g *Gateway) handlePublicTraffic(w http.ResponseWriter, r *http.Request) {
	host := r.Host
	// Remove port from host if present
	if strings.Contains(host, ":") {
		h, _, err := net.SplitHostPort(host)
		if err == nil {
			host = h
		}
	}

	// Identify subdomain. Domain is free.dev.setu.com
	// If host is abc.free.dev.setu.com, subdomain is abc.
	var subdomain string
	suffix := "." + g.tunnelDomain
	if strings.HasSuffix(host, suffix) {
		subdomain = strings.TrimSuffix(host, suffix)
	} else {
		// If accessing gateway directly, show a landing status page
		g.showLandingPage(w, r)
		return
	}

	session, ok := g.registry.Get(subdomain)
	if !ok {
		g.showTunnelOffline(w, subdomain)
		return
	}

	// Setup Reverse Proxy routing through Yamux Session
	director := func(req *http.Request) {
		req.URL.Scheme = "http"
		req.URL.Host = "127.0.0.1" // Target host inside user's local server
		// Pass original host headers
		req.Header.Set("X-Forwarded-Host", r.Host)
		req.Header.Set("X-Forwarded-Proto", "http")
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
			log.Printf("[Proxy Error] %s -> %v", subdomain, err)
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

func (g *Gateway) showLandingPage(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`<!DOCTYPE html>
<html>
<head>
    <title>Setu Tunnel Gateway</title>
    <style>
        body { background: #09090b; color: #fafafa; font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .card { background: rgba(255,255,255,0.05); padding: 2rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); text-align: center; max-width: 400px; box-shadow: 0 4px 30px rgba(0,0,0,0.5); }
        h1 { margin: 0; font-size: 1.8rem; background: linear-gradient(to right, #a855f7, #6366f1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        p { color: #a1a1aa; font-size: 0.9rem; margin-top: 1rem; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Setu Gateway Active</h1>
        <p>This entrypoint serves public tunnel routing and WebSocket tunnel control planes.</p>
        <p style="font-size: 0.8rem; color: #71717a;">Please connect your Setu CLI to start exposing local services.</p>
    </div>
</body>
</html>`))
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
