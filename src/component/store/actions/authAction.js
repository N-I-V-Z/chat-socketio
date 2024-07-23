import actionTypes from './actionTypes';

export const login = (userId) => async (dispatch) => {
    try {
        if (userId) {
            dispatch({
                type: actionTypes.LOGIN_SUCCESS,
                data: userId,
            })
        } else {
            dispatch({
                type: actionTypes.LOGIN_SUCCESS,
                date: null,
            })
        }
    } catch (error) {
        dispatch({
            type: actionTypes.LOGIN_SUCCESS,
            date: null,
        })
    }
};

export const logout = () => ({
    type: actionTypes.LOGOUT
})
