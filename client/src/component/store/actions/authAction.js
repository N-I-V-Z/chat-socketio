import actionTypes from "./actionTypes";

export const login = (user) => async (dispatch) => {
  try {
    if (user) {
      dispatch({
        type: actionTypes.LOGIN_SUCCESS,
        data: user,
      });
    } else {
      dispatch({
        type: actionTypes.LOGIN_SUCCESS,
        date: null,
      });
    }
  } catch (error) {
    dispatch({
      type: actionTypes.LOGIN_SUCCESS,
      date: null,
    });
  }
};

export const logout = () => ({
  type: actionTypes.LOGOUT,
});
