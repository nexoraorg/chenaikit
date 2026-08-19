// apps/frontend — web app entrypoint
// Moved fresh from the old standalone `frontend/` per issue #286.

import ReactDOM from "react-dom/client";
import "./index.css";
import { App } from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
