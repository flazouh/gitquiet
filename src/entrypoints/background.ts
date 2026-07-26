import { defineBackground } from "wxt/utils/define-background"
import { initialiseErrorReporting } from "@/observability/sentry"

export default defineBackground(() => {
  initialiseErrorReporting("service-worker")
})
