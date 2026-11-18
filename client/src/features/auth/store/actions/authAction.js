import actionTypes from "./actionTypes";

export const login = (user) => ({
  type: actionTypes.LOGIN_SUCCESS,
  data: user,
});

export const logout = () => ({
  type: actionTypes.LOGOUT,
});
