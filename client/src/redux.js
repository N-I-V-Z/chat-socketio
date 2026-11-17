import { configureStore } from "@reduxjs/toolkit";
import rootReducer from "./component/store/reduces/rootReducer";

const reduxStore = () => {
  return configureStore({ reducer: rootReducer });
};

export default reduxStore;
