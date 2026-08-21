package main

import (
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"

	_ "github.com/heypoom/patchies/server/migrations"
)

func main() {
	frontend, err := newFrontendHandler(os.Getenv("PATCHIES_DEV_PROXY_URL"))
	if err != nil {
		log.Fatal(err)
	}

	app := newApp(os.Getenv("PATCHIES_DATA_DIR"))
	if err := prepareRuntimeDataDir(app.DataDir()); err != nil {
		log.Fatal(err)
	}

	if err := initializeApp(app); err != nil {
		log.Fatal(err)
	}

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/api/healthz", healthz)
		se.Router.GET("/{path...}", serveFrontend(frontend))

		return se.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

func newApp(dataDir string) *pocketbase.PocketBase {
	return pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: dataDir})
}

func initializeApp(app *pocketbase.PocketBase) error {
	if err := app.Bootstrap(); err != nil {
		return fmt.Errorf("bootstrap PocketBase: %w", err)
	}

	if err := app.RunAllMigrations(); err != nil {
		return fmt.Errorf("run PocketBase migrations: %w", err)
	}

	return nil
}

// healthz responds to orchestration probes without exposing server internals.
func healthz(e *core.RequestEvent) error {
	return e.JSON(http.StatusOK, map[string]string{"status": "ok"})
}

func newFrontendHandler(proxyURL string) (http.Handler, error) {
	if proxyURL != "" {
		target, err := url.Parse(proxyURL)
		if err != nil {
			return nil, fmt.Errorf("parse frontend proxy URL: %w", err)
		}

		if target.Scheme == "" || target.Host == "" {
			return nil, fmt.Errorf("frontend proxy URL must include a scheme and host")
		}

		return httputil.NewSingleHostReverseProxy(target), nil
	}

	frontend, err := frontendFiles()
	if err != nil {
		return nil, err
	}

	return http.FileServer(http.FS(frontend)), nil
}

func serveFrontend(frontend http.Handler) func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		frontend.ServeHTTP(e.Response, e.Request)

		return nil
	}
}
