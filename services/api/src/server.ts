import { LOCAL_API_ORIGIN } from "@cairvia/config";
import { startLocalApi } from "./index.js";

await startLocalApi();
console.log(`Cairvia local API ${LOCAL_API_ORIGIN}`);
