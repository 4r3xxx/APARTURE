import "dotenv/config";
import { createPhotoboothServer } from "./server.js";

const port = Number(process.env.PORT ?? 4000);
const { httpServer } = createPhotoboothServer();

httpServer.listen(port, () => {
  console.log(`Photobooth signaling server listening on port ${port}`);
});
