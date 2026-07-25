import { defineBackground } from "wxt/utils/define-background"
import { initialiseErrorReporting } from "../src/observability/sentry"

export default defineBackground(() => {
  initialiseErrorReporting("service-worker")
})
