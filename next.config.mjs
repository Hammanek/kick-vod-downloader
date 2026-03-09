/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        unoptimized: true,
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'images.kick.com',
            },
            {
                protocol: 'https',
                hostname: 'kick-prod-videos.s3.us-west-2.amazonaws.com',
            },
        ],
    }
};

export default nextConfig;
