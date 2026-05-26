import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import axios from 'axios';
import baseConf from '@/base/config';

export const pendingMap = new Map();

export const service = axios.create({
    baseURL: `${baseConf.baseURL}`,
    timeout: 30000,
});

service.interceptors.request.use(
    config => {
        const pendingKey = getPendingKey(config);
        if (pendingMap.has(pendingKey)) {
            const controller = pendingMap.get(pendingKey);
            controller.abort();
        } else {
            addPending(config);
        }
        return config;
    },
    error => Promise.reject(error)
);

service.interceptors.response.use(
    response => {
        removePending(response.config);
        return response;
    },
    error => {
        error.config && removePending(error.config);
        error.message = getHttpErrorMsg(error);
        return Promise.reject(error);
    }
);

type Config = AxiosRequestConfig & { debounceRequest?: boolean };

export function request(axiosConfig: Config): Promise<AxiosResponse<any, any>> {
    const options = Object.assign({ debounceRequest: true }, axiosConfig);
    return service(options);
}

function getPendingKey(config: AxiosRequestConfig) {
    const { url, method, params } = config;
    let { data } = config;
    if (typeof data === 'string') data = JSON.parse(data);
    return [url, method, JSON.stringify(params), JSON.stringify(data)].join('&');
}

function addPending(config: AxiosRequestConfig) {
    const pendingKey = getPendingKey(config);
    const controller = new AbortController();
    config.signal = controller.signal;
    pendingMap.set(pendingKey, controller);
}

function removePending(config: AxiosRequestConfig) {
    const pendingKey = getPendingKey(config);
    if (pendingMap.has(pendingKey)) pendingMap.delete(pendingKey);
}

export function abortAllPending() {
    for (const [key, value] of pendingMap.entries()) {
        value.abort();
        pendingMap.delete(key);
    }
}

function getHttpErrorMsg(error: any) {
    if (axios.isCancel(error)) {
        console.error(`重复请求：${(error as any).config.url} ${error.message}`);
        return error.message;
    }
    if (error?.message?.includes('timeout')) return '网络请求超时！';
    if (error?.message?.includes('Network')) return window.navigator.onLine ? '服务端异常！' : '您断网了！';
    if (error?.response) {
        switch (error.response.status) {
            case 401: return '未授权，请重新登录！';
            case 403: return '没有权限操作！';
            case 504: return '服务暂时无法访问，请稍后再试！';
            default: return '异常问题，请联系管理员！';
        }
    }
    return error?.message || '未知错误';
}
