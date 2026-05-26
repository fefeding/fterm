// 基础配置

const state = window.__INITIAL_STATE__ || {};
const config = state.config || {};
const prefix = config.prefix || '';
const apiUrl = config.apiUrl || '';

export default {
    ...config,
    state,
    prefix,
    apiUrl,
    baseURL: `${location.origin}` + prefix,
    timeout: 3e4,
};
