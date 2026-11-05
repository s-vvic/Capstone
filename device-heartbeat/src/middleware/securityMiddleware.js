import helmet from "helmet";
import cors from "cors";
export function configureSecurityMiddleware(app) {
  app.disable("x-powered-by");
  // VPN-internal HTTP is valid per ICD. Do not redirect it to public HTTPS.
  app.use(helmet({ strictTransportSecurity: false }));
  app.use(
    cors({
      methods: ["GET", "POST", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
}
