import actionTypes from "../actions/actionTypes";

const initState = {
  isLoggedIn: false,
  user: null,
};

const authReducer = (state = initState, action) => {
  switch (action.type) {
    case actionTypes.LOGIN_SUCCESS:
      return {
        ...state,
        isLoggedIn: action.data ? true : false,
        user: action.data
        };
    case actionTypes.LOGOUT:
      return {
        ...state,
        isLoggedIn: false,
        userId: null,
      };
    default:
      return state;
  }
};

export default authReducer;
