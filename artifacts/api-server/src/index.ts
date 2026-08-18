import app from "./app";
import { logger } from "./lib/logger";
import { initializeDatabase } from "./lib/mysql";

// Hosts usually inject PORT. Falling back to 3000 rather than throwing means a
// host that starts the app without it still comes up instead of crash-looping
// with nothing useful in the logs.
const rawPort = process.env["PORT"] ?? "3000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

initializeDatabase()
  .catch((error) => {
    logger.error({ err: error }, "MySQL initialization failed; API will remain available with database features disabled");
  })
  .finally(() => app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  }));
