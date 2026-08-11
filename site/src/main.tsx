import "@fontsource-variable/inter"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Page } from "./Page"
import "./index.css"

const page = document.getElementById("page")
if (page === null) throw new Error("#page is missing from index.html")

createRoot(page).render(
  <StrictMode>
    <Page />
  </StrictMode>
)
