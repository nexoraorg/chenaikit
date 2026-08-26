import { app } from "./app.js";

const rawPort = process.env.PORT ?? "3001";
const port = Number.parseInt(rawPort, 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT environment variable: "${process.env.PORT}". Must be an integer between 1 and 65535.`);
}

const server = app.listen(port, () => {
  console.log(`[backend] listening on :${port}`);
});

export { app } from "./app.js";
export { prisma } from "./db.js";
