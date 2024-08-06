import authReducer from "./authReducer";
import { combineReducers } from "redux";
import storage from "redux-persist/lib/storage";
import { persistReducer } from "redux-persist";
import autoMergeLevel2 from "redux-persist/es/stateReconciler/autoMergeLevel2";

const commonConfig = {
  storage,
  stateReconciler: autoMergeLevel2,
};

const authConfig = {
    ...commonConfig,
  key: "account",
  whitelist: ["isLoggedIn", "user"],
};

const rootReducer = combineReducers({
    auth: persistReducer(authConfig, authReducer)
})

export default rootReducer;
