import Image from "next/image";

type Variant = "light" | "white" | "transparent";

type Props = {
    size?: number;                // rendered px size (width & height)
    variant?: Variant;            // which asset to use
    className?: string;
    priority?: boolean;
    alt?: string;                 // optional override for accessibility
};

export default function Logo({
    size = 36,
    variant = "light",
    className = "",
    priority = false,
    alt = "4th Line Fantasy",
}: Props) {
    // Map variants to brand asset paths in /public/brand
    const srcMap = {
        light: "/brand/logo-4lf-circle-light.png",          // light-blue background
        white: "/brand/logo-4lf-circle-white.png",          // solid white background
        transparent: "/brand/logo-4lf-circle-transparent.png", // transparent background
    } as const;

    const src = srcMap[variant] ?? srcMap.light;

    return (
        <Image
            src={src}
            width={size}
            height={size}
            alt={alt}
            className={className}
            priority={priority}
        />
    );
}
