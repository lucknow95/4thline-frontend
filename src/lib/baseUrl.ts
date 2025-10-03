export function getBaseUrl() {
    // Priority: explicit env → fallback to Vercel's runtime host → localhost
    const envUrl =
        process.env.NEXT_PUBLIC_BASE_URL ||
        process.env.APP_BASE_URL ||
        process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`;

    return envUrl || 'http://localhost:3000';
}
