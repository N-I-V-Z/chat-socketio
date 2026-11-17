import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { Provider } from "react-redux";
import reduxStore from "./redux";
import { QueryClientProvider } from "@tanstack/react-query";
import queryClient from "./queryClient";

const store = reduxStore();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <QueryClientProvider client={queryClient}>
    <Provider store={store}>
      <React.StrictMode>
        <App />
      </React.StrictMode>
    </Provider>
  </QueryClientProvider>
);

reportWebVitals();
