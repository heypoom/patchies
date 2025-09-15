import "./styles/index.css"
import "@radix-ui/themes/styles.css"

import { Theme } from "@radix-ui/themes"
import React from "react"
import ReactDOM from "react-dom/client"

import App from "./App"

const root = document.getElementById("root")!

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <Theme appearance="dark">
      <App />
    </Theme>
  </React.StrictMode>,
)
