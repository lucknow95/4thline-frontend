"use client";

import { useEffect, useRef } from "react";

interface MerchBuyButtonProps {
    embedHtml: string;
}

export default function MerchBuyButton({ embedHtml }: MerchBuyButtonProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Inject Shopify embed HTML
        containerRef.current.innerHTML = embedHtml;

        // Force execution of embedded scripts (required by Shopify)
        const scripts = Array.from(
            containerRef.current.querySelectorAll("script")
        );

        scripts.forEach((oldScript) => {
            const newScript = document.createElement("script");

            Array.from(oldScript.attributes).forEach((attr) => {
                newScript.setAttribute(attr.name, attr.value);
            });

            newScript.text = oldScript.text;
            oldScript.replaceWith(newScript);
        });
    }, [embedHtml]);

    return <div ref={containerRef} />;
}

