// This fixture runs the production relay on an ephemeral local port for the
// cross-language coordinator/CLI integration test. It never loads user data.
package main

import (
	"fmt"
	"net"
	"net/http"
	"os"

	"github.com/heypoom/patchies/server/remotecontrol"
)

func main() {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Println("http://" + listener.Addr().String())
	if err := http.Serve(listener, remotecontrol.NewHTTPHandler(remotecontrol.NewRelay())); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
