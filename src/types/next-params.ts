// Accepts either a plain object or a Promise of it (Next 15 compat)
export type RouteProps<T extends object> = {
    params: T | Promise<T>;
};
