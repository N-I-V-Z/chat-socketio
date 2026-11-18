import { configureStore } from "@reduxjs/toolkit";
import rootReducer from "./features/auth/store/reduces/rootReducer";

const reduxStore = () => {
  return configureStore({ reducer: rootReducer });
};

export default reduxStore;
