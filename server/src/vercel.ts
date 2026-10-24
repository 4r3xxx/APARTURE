import { createPhotoboothServer } from "./server.js";

// Vercel routes WebSocket upgrades through the exported Node HTTP server.
const { httpServer } = createPhotoboothServer();

export default httpServer;
