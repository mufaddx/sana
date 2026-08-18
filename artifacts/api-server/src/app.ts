import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Built single-page app. In production one process serves both the API and the
// site, so the browser can call /api/... on its own origin.
const serverDir = path.dirname(fileURLToPath(import.meta.url));
const staticDir = process.env["STATIC_DIR"]
  ? path.resolve(process.env["STATIC_DIR"])
  : path.resolve(serverDir, "..", "..", "real-world-link", "dist", "public");

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api", router);

if (existsSync(staticDir)) {
  logger.info({ staticDir }, "Serving the built site");
  // Hashed asset filenames can be cached hard; index.html must not be.
  app.use(express.static(staticDir, { index: false, maxAge: "1y" }));
  // Client-side routing: anything that is not an API call or a real file
  // falls back to index.html so /track, /admin and /assessment load directly.
  app.get(/^(?!\/api\/).*/, (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    res.sendFile(path.join(staticDir, "index.html"), (error) => {
      if (error) next(error);
    });
  });
} else {
  logger.warn(
    { staticDir },
    "Built site not found; serving the API only. Run the real-world-link build, or set STATIC_DIR.",
  );
}

export default app;
