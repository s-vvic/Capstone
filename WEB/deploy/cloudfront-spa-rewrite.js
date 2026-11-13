// CloudFront Functions runtime 2.0. Associate with the S3 default behavior's
// Viewer request event, not the /v1/* API behavior.
function handler(event) {
  var request = event.request;
  if (request.method !== "GET" && request.method !== "HEAD") return request;

  var uri = request.uri.replace(/\/+$/, "") || "/";
  var routes = [
    "/",
    "/login",
    "/signup",
    "/find-pw",
    "/find-password",
    "/find-id",
    "/reset-password",
    "/dashboard",
    "/multiview",
    "/subscription",
    "/devices",
    "/event-logs",
    "/reports",
    "/vpn-manage",
    "/vpn-check",
    "/settings",
    "/settings/general",
    "/settings/notifications",
    "/settings/account",
    "/settings/subscription",
    "/settings/storage",
    "/settings/privacy-zones",
  ];
  if (
    routes.indexOf(uri) !== -1 ||
    /^\/monitoring\/[A-Za-z0-9_-]+$/.test(uri)
  ) {
    request.uri = "/index.html";
  }
  return request;
}
