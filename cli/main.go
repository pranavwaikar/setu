package main

import (
	"bufio"
	"bytes"
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"syscall"
	"time"

	"crypto/tls"

	"github.com/gorilla/websocket"
	"github.com/hashicorp/yamux"
	"github.com/pranavwaikar/setu/cli/internal/updater"
	verinfo "github.com/pranavwaikar/setu/cli/internal/version"
	"github.com/spf13/cobra"
)

type PortMapping struct {
	Subdomain string `json:"subdomain"`
	Port      string `json:"port"`
}

type Config struct {
	ApiKey       string        `json:"api_key"`
	Gateway      string        `json:"gateway"`
	PortMappings []PortMapping `json:"port_mappings"`
}

func getConfigPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ".setu_config.json"
	}
	dir := filepath.Join(home, ".setu")
	_ = os.MkdirAll(dir, 0700)
	return filepath.Join(dir, "config.json")
}

func getDefaultGateway() string {
	g := os.Getenv("GATEWAY_URL")
	if g == "" {
		g = os.Getenv("PUBLIC_DOMAIN")
	}
	if g == "" {
		g = "setu.helios-logic.com"
	}
	g = strings.TrimPrefix(g, "https://")
	g = strings.TrimPrefix(g, "http://")
	g = strings.TrimSuffix(g, "/")
	return g
}

func loadConfig() (*Config, error) {
	path := getConfigPath()
	file, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return &Config{Gateway: getDefaultGateway()}, nil
		}
		return nil, err
	}
	defer file.Close()

	var cfg Config
	if err := json.NewDecoder(file).Decode(&cfg); err != nil {
		return nil, err
	}

	if cfg.Gateway == "" {
		cfg.Gateway = getDefaultGateway()
	}
	return &cfg, nil
}

func saveConfig(cfg *Config) error {
	path := getConfigPath()
	file, err := os.OpenFile(path, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		return err
	}
	defer file.Close()
	_ = os.Chmod(path, 0600) // Ensure permissions are set to 0600 even if file already existed

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	return encoder.Encode(cfg)
}

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

//go:embed setup-ui/*
var setupUIFS embed.FS

var gatewayFlag string
var hostHeaderFlag string
var insecureSkipVerifyFlag bool
var authFlag string
var tcpFlag bool

func main() {
	var rootCmd = &cobra.Command{
		Use:   "setu",
		Short: "Setu Tunnel Client CLI",
		Long:  `Expose your local development servers to the public internet securely.`,
	}

	var loginCmd = &cobra.Command{
		Use:   "login",
		Short: "Store credentials for authenticating with Setu gateway",
		Run: func(cmd *cobra.Command, args []string) {
			cfg, err := loadConfig()
			if err != nil {
				log.Fatalf("Error loading config: %v", err)
			}

			if gatewayFlag != "" {
				cfg.Gateway = gatewayFlag
			}

			reader := bufio.NewReader(os.Stdin)
			fmt.Print("Enter your Setu API Key: ")
			apiKey, err := reader.ReadString('\n')
			if err != nil {
				log.Fatalf("Failed to read input: %v", err)
			}
			apiKey = strings.TrimSpace(apiKey)

			if apiKey == "" {
				log.Fatalf("API Key cannot be empty")
			}

			cfg.ApiKey = apiKey
			if err := saveConfig(cfg); err != nil {
				log.Fatalf("Failed to save config: %v", err)
			}

			fmt.Println("\n✔ Credentials successfully stored!")
			fmt.Println("You can now expose ports using: setu expose <port> --subdomain <subdomain>")
		},
	}
	loginCmd.Flags().StringVar(&gatewayFlag, "gateway", "", "Custom Gateway host (e.g. 127.0.0.1:8080 or tunnel.setu.com)")

	var logoutCmd = &cobra.Command{
		Use:   "logout",
		Short: "Remove authentication credentials stored on this machine",
		Run: func(cmd *cobra.Command, args []string) {
			path := getConfigPath()
			if err := os.Remove(path); err != nil {
				if os.IsNotExist(err) {
					fmt.Println("Already logged out.")
					return
				}
				log.Fatalf("Error clearing credentials: %v", err)
			}
			fmt.Println("✔ Logged out successfully. Credentials cleared.")
		},
	}

	var statusCmd = &cobra.Command{
		Use:   "status",
		Short: "Check stored configuration status",
		Run: func(cmd *cobra.Command, args []string) {
			cfg, err := loadConfig()
			if err != nil {
				log.Fatalf("Failed to load config: %v", err)
			}
			fmt.Printf("Config path: %s\n", getConfigPath())
			fmt.Printf("Gateway:     %s\n", cfg.Gateway)
			if cfg.ApiKey != "" {
				fmt.Printf("API Key:     %s••••••••\n", cfg.ApiKey[:Min(len(cfg.ApiKey), 8)])
			} else {
				fmt.Println("API Key:     Not configured. Run 'setu login' first.")
			}
		},
	}

	var subdomainFlag string

	var exposeCmd = &cobra.Command{
		Use:   "expose [port]",
		Short: "Establish connection proxying a local port to a public subdomain",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			localPort := args[0]
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()

			inspectPort := startInspectServer()

			cfg, err := loadConfig()
			if err != nil {
				log.Fatalf("Failed to load config: %v", err)
			}

			if gatewayFlag != "" {
				cfg.Gateway = gatewayFlag
			}

			if cfg.ApiKey == "" {
				log.Fatalf("Authentication required. Run 'setu login' first.")
			}

			if subdomainFlag == "" {
				log.Fatalf("Subdomain required. Pass the --subdomain flag.")
			}

			// Verify dial target exists locally (fail early if port is completely offline)
			// Wait, we don't strictly require it to be online, but we can print a warning if not.
			_, targetHostPort := parseTarget(localPort)
			_, err = net.DialTimeout("tcp", targetHostPort, 1*time.Second)
			if err != nil {
				log.Printf("⚠️  Warning: No local server appears to be listening on %s. Tunnels will start, but requests may fail.", targetHostPort)
			}

			publicDomain := getPublicDisplayURL(cfg.Gateway, subdomainFlag)
			publicURL := "http://" + publicDomain

			fmt.Println("\n ⚡ SETU TUNNEL ONLINE")
			fmt.Println(" --------------------------------------------------")
			fmt.Printf(" Status:     ONLINE\n")
			fmt.Printf(" Forwarding: %s -> 127.0.0.1:%s\n", publicURL, localPort)
			if inspectPort > 0 {
				fmt.Printf(" Inspect UI: http://127.0.0.1:%d/inspect\n", inspectPort)
			}
			fmt.Println(" --------------------------------------------------")
			fmt.Println(" Press Ctrl+C to stop tunnel connection")
			fmt.Println(" Showcase Traffic logs:")

			// Handle termination signals
			sigChan := make(chan os.Signal, 1)
			signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

			go func() {
				<-sigChan
				fmt.Println("\nGracefully shutting down tunnel...")
				cancel()
				os.Exit(0)
			}()

			tunnelType := "http"
			if tcpFlag {
				tunnelType = "tcp"
			}
			runTunnelLoop(ctx, cfg.Gateway, subdomainFlag, localPort, cfg.ApiKey, hostHeaderFlag, insecureSkipVerifyFlag, authFlag, tunnelType)
		},
	}
	exposeCmd.Flags().StringVar(&subdomainFlag, "subdomain", "", "Subdomain hostname claimed on Setu Dashboard")
	exposeCmd.Flags().StringVar(&gatewayFlag, "gateway", "", "Custom Gateway host (e.g. 127.0.0.1:8080 or tunnel.setu.com)")
	exposeCmd.Flags().StringVar(&hostHeaderFlag, "host-header", "", "Rewrite the Host header of proxy requests (e.g., 'localhost:3000' or 'rewrite')")
	exposeCmd.Flags().BoolVar(&insecureSkipVerifyFlag, "insecure-skip-verify", false, "Accept self-signed certificates when proxying to local HTTPS endpoints")
	exposeCmd.Flags().StringVar(&authFlag, "auth", "", "Username and password for basic auth protection at the gateway edge (e.g., 'username:password')")
	exposeCmd.Flags().BoolVar(&tcpFlag, "tcp", false, "Expose raw TCP tunnel instead of HTTP")
	startCmd.Flags().StringVar(&gatewayFlag, "gateway", "", "Custom Gateway host (e.g. 127.0.0.1:8080 or tunnel.setu.com)")
	startCmd.Flags().StringVar(&hostHeaderFlag, "host-header", "", "Rewrite the Host header of proxy requests (e.g., 'localhost:3000' or 'rewrite')")
	startCmd.Flags().BoolVar(&insecureSkipVerifyFlag, "insecure-skip-verify", false, "Accept self-signed certificates when proxying to local HTTPS endpoints")
	startCmd.Flags().StringVar(&authFlag, "auth", "", "Username and password for basic auth protection at the gateway edge (e.g., 'username:password')")

	rootCmd.AddCommand(loginCmd)
	rootCmd.AddCommand(logoutCmd)
	rootCmd.AddCommand(statusCmd)
	rootCmd.AddCommand(exposeCmd)
	rootCmd.AddCommand(setupCmd)
	rootCmd.AddCommand(startCmd)
	rootCmd.AddCommand(versionCmd)
	rootCmd.AddCommand(updateCmd)
	rootCmd.AddCommand(doctorCmd)

	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

// ─── version command ─────────────────────────────────────────────────────────

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Show version information",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Printf("Setu CLI\n")
		fmt.Printf("  Version:    %s\n", verinfo.Version)
		fmt.Printf("  Commit:     %s\n", verinfo.Commit)
		fmt.Printf("  Build Date: %s\n", verinfo.BuildDate)
	},
}

// ─── update command ───────────────────────────────────────────────────────────

var updateCmd = &cobra.Command{
	Use:   "update",
	Short: "Update setu to the latest release from GitHub",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("Checking for updates...")

		release, err := updater.GetLatestRelease()
		if err != nil {
			log.Fatalf("Failed to fetch latest release: %v", err)
		}

		if !updater.IsUpdateAvailable(verinfo.Version, release) {
			fmt.Printf("✔ Already up to date (version %s).\n", verinfo.Version)
			return
		}

		fmt.Printf("New version available: %s (current: %s)\n", release.TagName, verinfo.Version)
		fmt.Println("Starting update...")

		err = updater.SelfUpdate(release, func(msg string) {
			fmt.Println(" ", msg)
		})
		if err != nil {
			log.Fatalf("Update failed: %v", err)
		}

		fmt.Printf("\n✔ Successfully updated to %s. Run 'setu version' to confirm.\n", release.TagName)
	},
}

// ─── doctor command ───────────────────────────────────────────────────────────

var doctorCmd = &cobra.Command{
	Use:   "doctor",
	Short: "Run diagnostics and check system health",
	Run: func(cmd *cobra.Command, args []string) {
		execPath, _ := os.Executable()
		execPath, _ = filepath.EvalSymlinks(execPath)

		fmt.Println("\n⚕  Setu Doctor")
		fmt.Println("──────────────────────────────────────")
		fmt.Printf("  Version:          %s\n", verinfo.Version)
		fmt.Printf("  Commit:           %s\n", verinfo.Commit)
		fmt.Printf("  Build Date:       %s\n", verinfo.BuildDate)
		fmt.Printf("  OS:               %s\n", runtime.GOOS)
		fmt.Printf("  Architecture:     %s\n", runtime.GOARCH)
		fmt.Printf("  Executable Path:  %s\n", execPath)
		fmt.Println("──────────────────────────────────────")

		// GitHub connectivity check
		fmt.Print("  GitHub API:       ")
		if err := updater.CheckConnectivity(); err != nil {
			fmt.Printf("✗ UNREACHABLE (%v)\n", err)
		} else {
			fmt.Println("✔ reachable")
		}

		// Update check
		fmt.Print("  Update Available: ")
		release, err := updater.GetLatestRelease()
		if err != nil {
			fmt.Printf("✗ could not check (%v)\n", err)
		} else if updater.IsUpdateAvailable(verinfo.Version, release) {
			fmt.Printf("yes — %s is available (run 'setu update')\n", release.TagName)
		} else {
			fmt.Println("✔ up to date")
		}
		fmt.Println("──────────────────────────────────────")
	},
}

var setupCmd = &cobra.Command{
	Use:   "setup",
	Short: "Start a local configuration panel in your web browser",
	Long:  `Launches a gorgeous web interface to manage your API Keys, claim subdomains, and configure port mappings.`,
	Run: func(cmd *cobra.Command, args []string) {
		cfg, err := loadConfig()
		if err != nil {
			log.Fatalf("Error loading config: %v", err)
		}
		runSetupServer(cfg)
	},
}

func getAPIServerURL(cfg *Config) string {
	if envAPI := os.Getenv("API_SERVER_URL"); envAPI != "" {
		return envAPI
	}
	gw := cfg.Gateway
	if gw == "" {
		gw = getDefaultGateway()
	}
	if !strings.HasPrefix(gw, "http://") && !strings.HasPrefix(gw, "https://") {
		// Use HTTPS for production domain, HTTP otherwise
		if gw == "setu.helios-logic.com" {
			gw = "https://" + gw
		} else {
			gw = "http://" + gw
		}
	}
	gw = strings.TrimSuffix(gw, "/")
	return gw + "/api"
}

func openBrowser(url string) {
	var err error
	switch runtime.GOOS {
	case "linux":
		err = exec.Command("xdg-open", url).Start()
	case "windows":
		err = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		err = exec.Command("open", url).Start()
	default:
		err = fmt.Errorf("unsupported platform")
	}
	if err != nil {
		log.Printf("Could not open browser: %v. Please open %s manually.", err, url)
	}
}

func runSetupServer(cfg *Config) {
	// 1. Find a free port dynamically
	port := 4040
	var listener net.Listener
	var err error
	for port <= 4090 {
		listener, err = net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
		if err == nil {
			break
		}
		port++
	}
	if err != nil {
		log.Fatalf("Failed to bind to any local port between 4040 and 4090: %v", err)
	}
	defer listener.Close()

	localURL := fmt.Sprintf("http://127.0.0.1:%d", port)
	fmt.Printf("\n ⚡ SETU SETUP PANEL ACTIVE\n")
	fmt.Printf(" --------------------------------------------------\n")
	fmt.Printf(" Server:      %s\n", localURL)
	fmt.Printf(" Config Path: %s\n", getConfigPath())
	fmt.Printf(" --------------------------------------------------\n")
	fmt.Printf(" Opening browser... Press Ctrl+C in terminal to stop setup server.\n\n")

	// 2. Open browser in a separate goroutine
	go func() {
		time.Sleep(500 * time.Millisecond)
		openBrowser(localURL)
	}()

	// 3. Define HTTP routes
	mux := http.NewServeMux()

	// Serve static files from embedded setup-ui folder
	subFS, err := fs.Sub(setupUIFS, "setup-ui")
	if err != nil {
		log.Fatalf("Failed to load embedded setup-ui assets: %v", err)
	}
	fileServer := http.FileServer(http.FS(subFS))

	// Serve static assets (index.html, style.css, app.js)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			// This fallback shouldn't handle api routes, ServeMux matches most specific path first.
			return
		}
		fileServer.ServeHTTP(w, r)
	})

	// GET/POST /api/config
	mux.HandleFunc("/api/config", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			c, err := loadConfig()
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			tunnelDomain := os.Getenv("TUNNEL_DOMAIN")
			if tunnelDomain == "" {
				tunnelDomain = "setu.helios-logic.com"
			}
			dashboardURL := os.Getenv("DASHBOARD_URL")
			if dashboardURL == "" {
				dashboardURL = os.Getenv("PUBLIC_DOMAIN")
			}
			if dashboardURL == "" {
				dashboardURL = "https://setu.helios-logic.com"
			}
			response := struct {
				Config
				TunnelDomain string `json:"tunnel_domain"`
				DashboardURL string `json:"dashboard_url"`
			}{
				Config:       *c,
				TunnelDomain: tunnelDomain,
				DashboardURL: dashboardURL,
			}
			json.NewEncoder(w).Encode(response)
			return
		}

		if r.Method == http.MethodPost {
			var newCfg Config
			if err := json.NewDecoder(r.Body).Decode(&newCfg); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			if err := saveConfig(&newCfg); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(newCfg)
			return
		}

		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	})

	// POST /api/validate-key
	mux.HandleFunc("/api/validate-key", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var reqBody struct {
			ApiKey string `json:"api_key"`
		}
		if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		apiURL := getAPIServerURL(cfg)
		client := &http.Client{Timeout: 5 * time.Second}
		req, err := http.NewRequest("GET", apiURL+"/auth/me", nil)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		req.Header.Set("X-API-Key", reqBody.ApiKey)

		resp, err := client.Do(req)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"valid": false,
				"error": "Failed to connect to API server: " + err.Error(),
			})
			return
		}
		defer resp.Body.Close()

		w.Header().Set("Content-Type", "application/json")
		if resp.StatusCode == http.StatusOK {
			var user struct {
				Email     string `json:"email"`
				FirstName string `json:"firstName"`
				LastName  string `json:"lastName"`
			}
			json.NewDecoder(resp.Body).Decode(&user)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"valid":     true,
				"email":     user.Email,
				"firstName": user.FirstName,
				"lastName":  user.LastName,
			})
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"valid": false,
				"error": "Invalid API key (HTTP " + fmt.Sprint(resp.StatusCode) + ")",
			})
		}
	})

	// GET/POST /api/subdomains
	mux.HandleFunc("/api/subdomains", func(w http.ResponseWriter, r *http.Request) {
		c, err := loadConfig()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		apiKey := c.ApiKey
		if apiKey == "" {
			http.Error(w, "API Key is required. Set it up on the Auth tab.", http.StatusUnauthorized)
			return
		}

		apiURL := getAPIServerURL(c)
		client := &http.Client{Timeout: 5 * time.Second}

		if r.Method == http.MethodGet {
			req, err := http.NewRequest("GET", apiURL+"/subdomains", nil)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			req.Header.Set("X-API-Key", apiKey)

			resp, err := client.Do(req)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadGateway)
				return
			}
			defer resp.Body.Close()

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(resp.StatusCode)
			io.Copy(w, resp.Body)
			return
		}

		if r.Method == http.MethodPost {
			bodyBytes, err := io.ReadAll(r.Body)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			req, err := http.NewRequest("POST", apiURL+"/subdomains", bytes.NewBuffer(bodyBytes))
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			req.Header.Set("X-API-Key", apiKey)
			req.Header.Set("Content-Type", "application/json")

			resp, err := client.Do(req)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadGateway)
				return
			}
			defer resp.Body.Close()

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(resp.StatusCode)
			io.Copy(w, resp.Body)
			return
		}

		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	})

	// DELETE /api/subdomains/release
	mux.HandleFunc("/api/subdomains/release", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		id := r.URL.Query().Get("id")
		if id == "" {
			http.Error(w, "Missing subdomain id parameter", http.StatusBadRequest)
			return
		}

		c, err := loadConfig()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		apiKey := c.ApiKey
		if apiKey == "" {
			http.Error(w, "API Key is required.", http.StatusUnauthorized)
			return
		}

		apiURL := getAPIServerURL(c)
		client := &http.Client{Timeout: 5 * time.Second}

		req, err := http.NewRequest("DELETE", apiURL+"/subdomains/"+id, nil)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		req.Header.Set("X-API-Key", apiKey)

		resp, err := client.Do(req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(resp.StatusCode)
		io.Copy(w, resp.Body)
	})

	var server *http.Server

	// POST /api/exit
	mux.HandleFunc("/api/exit", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{"success": true})

		// Gracefully shut down the server in a goroutine so response completes
		go func() {
			time.Sleep(500 * time.Millisecond)
			if server != nil {
				server.Close()
			}
		}()
	})

	// 4. Start HTTP Server
	server = &http.Server{
		Handler: mux,
	}

	// Graceful shutdown on Ctrl+C
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigChan
		server.Close()
	}()

	if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Setup server error: %v", err)
	}
}

func buildWebSocketURL(gateway, subdomain, port string, auth string, tunnelType string) string {
	rawURL := gateway
	if !strings.HasPrefix(rawURL, "http://") && !strings.HasPrefix(rawURL, "https://") && !strings.HasPrefix(rawURL, "ws://") && !strings.HasPrefix(rawURL, "wss://") {
		if rawURL == "setu.helios-logic.com" {
			rawURL = "wss://" + rawURL
		} else {
			rawURL = "ws://" + rawURL
		}
	}

	u, err := url.Parse(rawURL)
	if err != nil {
		log.Fatalf("Invalid gateway URL: %v", err)
	}

	// Map http -> ws, https -> wss
	if u.Scheme == "http" {
		u.Scheme = "ws"
	} else if u.Scheme == "https" {
		u.Scheme = "wss"
	}

	u.Path = "/tunnel/connect"
	q := u.Query()
	q.Set("subdomain", subdomain)
	q.Set("port", port)
	if auth != "" {
		q.Set("auth", auth)
	}
	if tunnelType != "" {
		q.Set("type", tunnelType)
	}
	u.RawQuery = q.Encode()

	return u.String()
}

func getPublicDisplayURL(gateway, subdomain string) string {
	cleanGateway := gateway
	if strings.HasPrefix(cleanGateway, "http://") {
		cleanGateway = strings.TrimPrefix(cleanGateway, "http://")
	} else if strings.HasPrefix(cleanGateway, "https://") {
		cleanGateway = strings.TrimPrefix(cleanGateway, "https://")
	} else if strings.HasPrefix(cleanGateway, "ws://") {
		cleanGateway = strings.TrimPrefix(cleanGateway, "ws://")
	} else if strings.HasPrefix(cleanGateway, "wss://") {
		cleanGateway = strings.TrimPrefix(cleanGateway, "wss://")
	}
	parts := strings.Split(cleanGateway, ":")
	host := parts[0]
	suffix := host
	if host == "127.0.0.1" || host == "localhost" {
		suffix = os.Getenv("TUNNEL_DOMAIN")
		if suffix == "" {
			suffix = "setu.helios-logic.com"
		}
	}
	return fmt.Sprintf("%s.%s", subdomain, suffix)
}

func parseTarget(target string) (scheme string, hostPort string) {
	if strings.HasPrefix(target, "https://") {
		return "https", strings.TrimPrefix(target, "https://")
	}
	if strings.HasPrefix(target, "http://") {
		return "http", strings.TrimPrefix(target, "http://")
	}
	if !strings.Contains(target, ":") {
		return "http", "127.0.0.1:" + target
	}
	return "http", target
}

func dialLocal(scheme, targetHostPort string, insecureSkipVerify bool, hostHeader string) (net.Conn, error) {
	dialer := &net.Dialer{Timeout: 2 * time.Second}
	if scheme == "https" {
		tlsConfig := &tls.Config{
			InsecureSkipVerify: insecureSkipVerify,
		}
		if hostHeader != "" && hostHeader != "rewrite" {
			sniHost := hostHeader
			if h, _, err := net.SplitHostPort(hostHeader); err == nil {
				sniHost = h
			}
			tlsConfig.ServerName = sniHost
		} else {
			if h, _, err := net.SplitHostPort(targetHostPort); err == nil {
				tlsConfig.ServerName = h
			} else {
				tlsConfig.ServerName = targetHostPort
			}
		}
		return tls.DialWithDialer(dialer, "tcp", targetHostPort, tlsConfig)
	}
	return dialer.Dial("tcp", targetHostPort)
}

func handleProxyStream(stream net.Conn, localPort string, publicDomain string, hostHeader string, insecureSkipVerify bool, tunnelType string) {
	defer stream.Close()

	scheme, targetHostPort := parseTarget(localPort)

	if tunnelType == "tcp" {
		localConn, dialErr := dialLocal(scheme, targetHostPort, insecureSkipVerify, hostHeader)
		if dialErr != nil {
			log.Printf("[Proxy Error] Failed to dial local target %s: %v", targetHostPort, dialErr)
			return
		}
		defer localConn.Close()

		errChan := make(chan error, 2)
		go func() {
			_, err := io.Copy(localConn, stream)
			errChan <- err
		}()
		go func() {
			_, err := io.Copy(stream, localConn)
			errChan <- err
		}()
		<-errChan
		return
	}

	reader := bufio.NewReader(stream)
	req, err := http.ReadRequest(reader)
	if err != nil {
		// Fallback to raw copy if HTTP parsing fails (e.g., raw TCP / ping)
		localConn, dialErr := dialLocal(scheme, targetHostPort, insecureSkipVerify, hostHeader)
		if dialErr != nil {
			log.Printf("[Proxy Error] Failed to dial local target %s: %v", targetHostPort, dialErr)
			return
		}
		defer localConn.Close()

		errChan := make(chan error, 2)
		go func() {
			_, err := io.Copy(localConn, reader)
			errChan <- err
		}()
		go func() {
			_, err := io.Copy(stream, localConn)
			errChan <- err
		}()
		<-errChan
		return
	}

	// Format timestamp
	timeStr := time.Now().Format("15:04:05")
	fmt.Printf("[%s] %-6s %s%s -> %s\n", timeStr, req.Method, publicDomain, req.URL.Path, targetHostPort)

	var reqBodyBytes []byte
	if req.Body != nil {
		reqBodyBytes, _ = io.ReadAll(io.LimitReader(req.Body, 1024*1024))
		req.Body = io.NopCloser(bytes.NewBuffer(reqBodyBytes))
	}

	if hostHeader != "" {
		if hostHeader == "rewrite" {
			port := localPort
			if strings.Contains(targetHostPort, ":") {
				_, p, err := net.SplitHostPort(targetHostPort)
				if err == nil {
					port = p
				}
			}
			req.Host = "localhost:" + port
		} else {
			req.Host = hostHeader
		}
	}

	localConn, err := dialLocal(scheme, targetHostPort, insecureSkipVerify, hostHeader)
	if err != nil {
		log.Printf("[Proxy Error] Failed to dial local target %s: %v", targetHostPort, err)
		return
	}
	defer localConn.Close()

	err = req.Write(localConn)
	if err != nil {
		log.Printf("[Proxy Error] Failed to forward request headers: %v", err)
		return
	}

	resp, err := http.ReadResponse(bufio.NewReader(localConn), req)
	if err != nil {
		log.Printf("[Proxy Error] Failed to read response: %v", err)
		return
	}
	defer resp.Body.Close()

	var respBodyBytes []byte
	if resp.Body != nil {
		respBodyBytes, _ = io.ReadAll(io.LimitReader(resp.Body, 1024*1024))
		resp.Body = io.NopCloser(bytes.NewBuffer(respBodyBytes))
	}

	tx := HTTPTransaction{
		ID:             fmt.Sprintf("%d", time.Now().UnixNano()),
		Timestamp:      time.Now().Format("15:04:05.000"),
		Method:         req.Method,
		URL:            fmt.Sprintf("http://%s%s", publicDomain, req.URL.Path),
		Path:           req.URL.Path,
		LocalTarget:    scheme + "://" + targetHostPort,
		ReqHeaders:     req.Header,
		ReqBody:        string(reqBodyBytes),
		RespStatus:     resp.StatusCode,
		RespStatusText: strings.TrimPrefix(resp.Status, fmt.Sprintf("%d ", resp.StatusCode)),
		RespHeaders:    resp.Header,
		RespBody:       string(respBodyBytes),
	}
	addTransaction(tx)

	err = resp.Write(stream)
	if err != nil {
		log.Printf("[Proxy Error] Failed to write response to stream: %v", err)
	}
}

var startCmd = &cobra.Command{
	Use:   "start",
	Short: "Start all tunnels defined in local port mappings configuration",
	Run: func(cmd *cobra.Command, args []string) {
		cfg, err := loadConfig()
		if err != nil {
			log.Fatalf("Failed to load config: %v", err)
		}

		if cfg.ApiKey == "" {
			log.Fatalf("Authentication required. Run 'setu login' or 'setu setup' first.")
		}

		inspectPort := startInspectServer()

		if len(cfg.PortMappings) == 0 {
			fmt.Println("No port mappings configured. Please run 'setu setup' to configure subdomains and port mappings.")
			return
		}

		if gatewayFlag != "" {
			cfg.Gateway = gatewayFlag
		}

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		go func() {
			<-sigChan
			fmt.Println("\nStopping all tunnels...")
			cancel()
			os.Exit(0)
		}()

		fmt.Println("\n ⚡ SETU MULTI-TUNNEL ACTIVE")
		fmt.Println(" --------------------------------------------------")
		fmt.Println(" Active Mappings:")
		for _, m := range cfg.PortMappings {
			publicDomain := getPublicDisplayURL(cfg.Gateway, m.Subdomain)
			fmt.Printf("   http://127.0.0.1:%-5s is mapped to http://%s\n", m.Port, publicDomain)
		}
		if inspectPort > 0 {
			fmt.Printf(" Inspect UI:      http://127.0.0.1:%d/inspect\n", inspectPort)
		}
		fmt.Println(" --------------------------------------------------")
		fmt.Println(" Showcase Traffic logs:")

		var wg sync.WaitGroup
		for _, mapping := range cfg.PortMappings {
			wg.Add(1)
			go func(m PortMapping) {
				defer wg.Done()
				runTunnelLoop(ctx, cfg.Gateway, m.Subdomain, m.Port, cfg.ApiKey, hostHeaderFlag, insecureSkipVerifyFlag, authFlag, "http")
			}(mapping)
		}

		wg.Wait()
	},
}

func runTunnelLoop(ctx context.Context, gateway, subdomain, localPort, apiKey string, hostHeader string, insecureSkipVerify bool, auth string, tunnelType string) {
	publicDomain := getPublicDisplayURL(gateway, subdomain)
	backoff := 1 * time.Second
	maxBackoff := 60 * time.Second

	for {
		select {
		case <-ctx.Done():
			return
		default:
			connectURL := buildWebSocketURL(gateway, subdomain, localPort, auth, tunnelType)
			headers := make(http.Header)
			headers.Set("X-API-Key", apiKey)

			dialer := websocket.Dialer{
				HandshakeTimeout: 10 * time.Second,
			}

			conn, resp, err := dialer.DialContext(ctx, connectURL, headers)
			if err != nil {
				errMsg := err.Error()
				if resp != nil {
					defer resp.Body.Close()
					body, _ := io.ReadAll(resp.Body)
					errMsg = fmt.Sprintf("HTTP %d: %s", resp.StatusCode, string(body))
				}
				log.Printf("[%s] Connection failed: %s. Retrying in %v...", subdomain, errMsg, backoff)
				select {
				case <-ctx.Done():
					return
				case <-time.After(backoff):
					backoff *= 2
					if backoff > maxBackoff {
						backoff = maxBackoff
					}
					continue
				}
			}

			// Read handshake response
			var handshake struct {
				Status  string `json:"status"`
				TCPPort int    `json:"tcp_port"`
				Error   string `json:"error"`
			}
			err = conn.ReadJSON(&handshake)
			if err != nil {
				conn.Close()
				log.Printf("[%s] Handshake read failed: %v. Retrying...", subdomain, err)
				continue
			}
			if handshake.Error != "" {
				conn.Close()
				log.Printf("[%s] Handshake returned error: %s. Retrying...", subdomain, handshake.Error)
				continue
			}

			// Reset backoff on successful connection
			backoff = 1 * time.Second

			netConn := newWSConn(conn)
			yamuxConfig := yamux.DefaultConfig()
			yamuxConfig.KeepAliveInterval = 15 * time.Second
			yamuxConfig.ConnectionWriteTimeout = 10 * time.Second

			session, err := yamux.Client(netConn, yamuxConfig)
			if err != nil {
				netConn.Close()
				log.Printf("[%s] Yamux client initialization failed: %v. Retrying...", subdomain, err)
				continue
			}

			tunnelCtx, cancelTunnel := context.WithCancel(ctx)
			go func() {
				<-session.CloseChan()
				cancelTunnel()
			}()

			go startHeartbeat(tunnelCtx, conn)

			if tunnelType == "tcp" {
				parts := strings.Split(gateway, ":")
				host := parts[0]
				if strings.HasPrefix(host, "http://") {
					host = strings.TrimPrefix(host, "http://")
				} else if strings.HasPrefix(host, "https://") {
					host = strings.TrimPrefix(host, "https://")
				} else if strings.HasPrefix(host, "ws://") {
					host = strings.TrimPrefix(host, "ws://")
				} else if strings.HasPrefix(host, "wss://") {
					host = strings.TrimPrefix(host, "wss://")
				}
				if host == "127.0.0.1" || host == "localhost" {
					host = os.Getenv("TUNNEL_DOMAIN")
					if host == "" {
						host = "setu.helios-logic.com"
					}
				}
				log.Printf("[%s] Connected successfully. Raw TCP Forwarding: %s:%d -> 127.0.0.1:%s", subdomain, host, handshake.TCPPort, localPort)
			} else {
				log.Printf("[%s] Connected successfully.", subdomain)
			}

			for {
				select {
				case <-tunnelCtx.Done():
					break
				default:
					stream, err := session.Accept()
					if err != nil {
						break
					}
					go handleProxyStream(stream, localPort, publicDomain, hostHeader, insecureSkipVerify, tunnelType)
				}
			}

			session.Close()
			netConn.Close()

			select {
			case <-ctx.Done():
				return
			default:
				log.Printf("[%s] Connection lost. Retrying in %v...", subdomain, backoff)
				select {
				case <-ctx.Done():
					return
				case <-time.After(backoff):
					backoff *= 2
					if backoff > maxBackoff {
						backoff = maxBackoff
					}
				}
			}
		}
	}
}

func Min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func startHeartbeat(ctx context.Context, conn *websocket.Conn) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			err := conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(5*time.Second))
			if err != nil {
				return
			}
		}
	}
}

type HTTPTransaction struct {
	ID             string              `json:"id"`
	Timestamp      string              `json:"timestamp"`
	Method         string              `json:"method"`
	URL            string              `json:"url"`
	Path           string              `json:"path"`
	LocalTarget    string              `json:"local_target"`
	ReqHeaders     map[string][]string `json:"req_headers"`
	ReqBody        string              `json:"req_body"`
	RespStatus     int                 `json:"resp_status"`
	RespStatusText string              `json:"resp_status_text"`
	RespHeaders    map[string][]string `json:"resp_headers"`
	RespBody       string              `json:"resp_body"`
}

var (
	txMu         sync.RWMutex
	transactions []HTTPTransaction

	clientsMu      sync.Mutex
	inspectClients = make(map[*websocket.Conn]bool)
	wsUpgrader     = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}
	inspectServerOnce sync.Once
	inspectPort       int
)

func addTransaction(tx HTTPTransaction) {
	txMu.Lock()
	defer txMu.Unlock()
	transactions = append([]HTTPTransaction{tx}, transactions...)
	if len(transactions) > 100 {
		transactions = transactions[:100]
	}

	clientsMu.Lock()
	defer clientsMu.Unlock()
	for client := range inspectClients {
		_ = client.WriteJSON(tx)
	}
}

func startInspectServer() int {
	inspectServerOnce.Do(func() {
		port := 4500
		for port < 4550 {
			ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
			if err == nil {
				ln.Close()
				inspectPort = port
				go runInspectServer(port)
				return
			}
			port++
		}
	})
	return inspectPort
}

func runInspectServer(port int) {
	mux := http.NewServeMux()

	subFS, err := fs.Sub(setupUIFS, "setup-ui")
	if err != nil {
		log.Printf("[Inspect UI Error] Failed to load assets: %v", err)
		return
	}

	mux.HandleFunc("/inspect", func(w http.ResponseWriter, r *http.Request) {
		data, err := subFS.Open("inspect.html")
		if err != nil {
			http.Error(w, "Not Found", http.StatusNotFound)
			return
		}
		defer data.Close()
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		io.Copy(w, data)
	})

	mux.HandleFunc("/inspect/replay", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		id := r.URL.Query().Get("id")
		if id == "" {
			http.Error(w, "Missing id parameter", http.StatusBadRequest)
			return
		}

		txMu.RLock()
		var foundTx *HTTPTransaction
		for _, tx := range transactions {
			if tx.ID == id {
				foundTx = &tx
				break
			}
		}
		txMu.RUnlock()

		if foundTx == nil {
			http.Error(w, "Transaction not found", http.StatusNotFound)
			return
		}

		// Replay the request directly to the local target
		client := &http.Client{
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{
					InsecureSkipVerify: insecureSkipVerifyFlag,
				},
			},
			Timeout: 10 * time.Second,
		}

		targetURL := foundTx.LocalTarget + foundTx.Path
		req, err := http.NewRequest(foundTx.Method, targetURL, strings.NewReader(foundTx.ReqBody))
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Failed to create request: " + err.Error(),
			})
			return
		}

		// Copy original headers
		for name, values := range foundTx.ReqHeaders {
			for _, value := range values {
				req.Header.Add(name, value)
			}
		}

		resp, err := client.Do(req)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadGateway)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "Failed to connect to local target: " + err.Error(),
			})
			return
		}
		defer resp.Body.Close()

		respBodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 1024*1024))

		// Record the replayed response in log list
		replayedTx := HTTPTransaction{
			ID:             fmt.Sprintf("%d", time.Now().UnixNano()),
			Timestamp:      time.Now().Format("15:04:05.000"),
			Method:         foundTx.Method,
			URL:            foundTx.URL,
			Path:           foundTx.Path,
			LocalTarget:    foundTx.LocalTarget,
			ReqHeaders:     foundTx.ReqHeaders,
			ReqBody:        foundTx.ReqBody,
			RespStatus:     resp.StatusCode,
			RespStatusText: strings.TrimPrefix(resp.Status, fmt.Sprintf("%d ", resp.StatusCode)),
			RespHeaders:    resp.Header,
			RespBody:       string(respBodyBytes),
		}
		addTransaction(replayedTx)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"id":      replayedTx.ID,
		})
	})

	mux.HandleFunc("/inspect/ws", func(w http.ResponseWriter, r *http.Request) {
		conn, err := wsUpgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("[Inspect WS Upgrade Error] %v", err)
			return
		}

		clientsMu.Lock()
		inspectClients[conn] = true
		clientsMu.Unlock()

		txMu.RLock()
		for i := len(transactions) - 1; i >= 0; i-- {
			_ = conn.WriteJSON(transactions[i])
		}
		txMu.RUnlock()

		defer func() {
			clientsMu.Lock()
			delete(inspectClients, conn)
			clientsMu.Unlock()
			conn.Close()
		}()

		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				break
			}
		}
	})

	addr := fmt.Sprintf("127.0.0.1:%d", port)
	log.Printf("[Inspect Dashboard] Running at http://%s/inspect", addr)
	server := &http.Server{Addr: addr, Handler: mux}
	_ = server.ListenAndServe()
}
