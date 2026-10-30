import { render } from "solid-js/web";
import { App } from "./App";
import "./music.css";

const root = document.getElementById("root")!;
root.textContent = "";
render(() => <App />, root);
