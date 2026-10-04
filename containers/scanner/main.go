// The scanner's HTTP front end. POST /scan streams the request body to clamd (INSTREAM over its
// local socket) and answers {"verdict": "clean" | "infected" | "error", "signature": ...}.
// GET on any path answers 200 once clamd is ready and 503 before. Standard library only.
package main

import (
	"encoding/binary"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net"
	"net/http"
	"strings"
	"time"
)

const (
	clamdSocket = "/tmp/clamd.sock"
	chunkSize   = 64 * 1024
	maxBytes    = 2100 * 1024 * 1024
)

type result struct {
	Verdict   string  `json:"verdict"`
	Signature *string `json:"signature"`
	Detail    string  `json:"detail,omitempty"`
}

func clamd(command string, timeout time.Duration) (net.Conn, error) {
	conn, err := net.DialTimeout("unix", clamdSocket, 2*time.Second)
	if err != nil {
		return nil, err
	}
	_ = conn.SetDeadline(time.Now().Add(timeout))
	if _, err := conn.Write([]byte(command)); err != nil {
		conn.Close()
		return nil, err
	}
	return conn, nil
}

func readReply(conn net.Conn) (string, error) {
	reply, err := io.ReadAll(io.LimitReader(conn, 4096))
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(strings.TrimRight(string(reply), "\x00")), nil
}

func ready() bool {
	conn, err := clamd("zPING\x00", 2*time.Second)
	if err != nil {
		return false
	}
	defer conn.Close()
	reply, err := readReply(conn)
	return err == nil && reply == "PONG"
}

func respond(w http.ResponseWriter, status int, body result) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// scan streams body to clamd and returns its reply, such as "stream: OK" or
// "stream: Eicar-Test-Signature FOUND".
func scan(body io.Reader) (string, error) {
	conn, err := clamd("zINSTREAM\x00", 10*time.Minute)
	if err != nil {
		return "", err
	}
	defer conn.Close()
	buffer := make([]byte, chunkSize)
	header := make([]byte, 4)
	sent := 0
	for {
		n, readErr := body.Read(buffer)
		if n > 0 {
			sent += n
			if sent > maxBytes {
				return "", errors.New("too large to scan")
			}
			binary.BigEndian.PutUint32(header, uint32(n))
			if _, err := conn.Write(header); err != nil {
				return "", err
			}
			if _, err := conn.Write(buffer[:n]); err != nil {
				return "", err
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return "", readErr
		}
	}
	binary.BigEndian.PutUint32(header, 0)
	if _, err := conn.Write(header); err != nil {
		return "", err
	}
	return readReply(conn)
}

func handle(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		if ready() {
			respond(w, http.StatusOK, result{Verdict: "ready"})
		} else {
			respond(w, http.StatusServiceUnavailable, result{Verdict: "starting"})
		}
		return
	}
	if r.Method != http.MethodPost || r.URL.Path != "/scan" {
		respond(w, http.StatusNotFound, result{Verdict: "error"})
		return
	}
	if !ready() {
		respond(w, http.StatusServiceUnavailable, result{Verdict: "error", Detail: "clamd is starting"})
		return
	}
	reply, err := scan(r.Body)
	switch {
	case err != nil:
		respond(w, http.StatusInternalServerError, result{Verdict: "error", Detail: err.Error()})
	case strings.Contains(reply, "size limit exceeded"):
		respond(w, http.StatusInternalServerError, result{Verdict: "error", Detail: "too large to scan"})
	case strings.HasSuffix(reply, " OK"):
		respond(w, http.StatusOK, result{Verdict: "clean"})
	case strings.HasSuffix(reply, " FOUND"):
		signature := strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(reply, "stream:"), "FOUND"))
		respond(w, http.StatusOK, result{Verdict: "infected", Signature: &signature})
	default:
		respond(w, http.StatusInternalServerError, result{Verdict: "error", Detail: reply})
	}
	// One line per scan, without file names or contents.
	log.Printf("%s %s %s", r.Method, r.URL.Path, reply)
}

func main() {
	server := &http.Server{
		Addr:    ":8080",
		Handler: http.HandlerFunc(handle),
		// Headers must arrive promptly; a body may take as long as a 2 GB upload takes to stream.
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       2 * time.Minute,
	}
	log.Fatal(server.ListenAndServe())
}
