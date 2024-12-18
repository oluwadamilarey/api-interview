import { app } from "./app";
import { createServer } from "http";
import { logger } from "./config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info("Database connection established");

    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });

    // Graceful shutdown handler
    const shutdown = async () => {
      logger.info("Shutting down server...");

      server.close(async (err) => {
        if (err) {
          logger.error("Error during server shutdown:", err);
          process.exit(1);
        }

        try {
          await prisma.$disconnect();
          logger.info("Database connection closed");
          process.exit(0);
        } catch (err) {
          logger.error("Error closing database connection:", err);
          process.exit(1);
        }
      });

      // Force shutdown after 5 seconds
      setTimeout(() => {
        logger.error(
          "Could not close connections in time, forcefully shutting down"
        );
        process.exit(1);
      }, 5000);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    logger.error("Failed to start server:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Handle any uncaught startup errors
startServer().catch(async (error) => {
  logger.error("Startup error:", error);
  await prisma.$disconnect();
  process.exit(1);
});

export { server };
