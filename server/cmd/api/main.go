package main

import (
	"log"
	"net/http"
	"os"

	"web-fps/server/internal/rooms"
	"web-fps/server/internal/ws"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	manifestPath := os.Getenv("MAP_MANIFEST_PATH")
	if manifestPath == "" {
		manifestPath = "../shared/maps/maps.json"
	}

	manager, err := rooms.NewManager(manifestPath)
	if err != nil {
		log.Fatalf("rooms manager init failed: %v", err)
	}
	hub := ws.NewHub(manager)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
	})
	mux.HandleFunc("/ws", hub.HandleWS)

	addr := ":" + port
	log.Printf("server listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
