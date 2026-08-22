import { app } from "./app.js";

const port = process.env.PORT ?? 3001;

app.listen(port, () => {
  console.log(`[backend] listening on :${port}`);
});

export { app } from "./app.js";
export { prisma } from "./db.js";
