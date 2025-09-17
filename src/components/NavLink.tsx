"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PropsWithChildren } from "react";

type Props = PropsWithChildren<{
    href: string;
    exact?: boolean;
    className?: string;
}>;

export default function NavLink({ href, exact = true, children, className = "" }: Props) {
    const pathname = usePathname();
    const isActive = exact ? pathname === href : pathname.startsWith(href);
    const classes = `nav-link ${isActive ? "nav-link-active" : ""} ${className}`.trim();

    return (
        <Link
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={classes}
        >
            {children}
        </Link>
    );
}
