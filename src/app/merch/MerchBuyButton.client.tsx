"use client";

import { useEffect, useRef } from "react";

export interface MerchBuyButtonProps {
    embedHtml: string;
}

export default function MerchBuyButton({
    embedHtml,
}: MerchBuyButtonProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Clear previous content (prevents duplicate embeds)
        containerRef.current.innerHTML = "";

        // Inject Shopify embed HTML
        const wrapper = document.createElement("div");
        wrapper.innerHTML = embedHtml;
        containerRef.current.appendChild(wrapper);

        // Force execution of embedded scripts (required by Shopify)
        const scripts = Array.from(wrapper.querySelectorAll("script"));

        scripts.forEach((oldScript) => {
            const newScript = document.createElement("script");

            // Copy attributes
            Array.from(oldScript.attributes).forEach((attr) => {
                newScript.setAttribute(attr.name, attr.value);
            });

            if (oldScript.src) {
                newScript.src = oldScript.src;
                newScript.async = true;
            } else {
                newScript.text = oldScript.text;
            }

            document.body.appendChild(newScript);
            oldScript.remove();
        });
    }, [embedHtml]);

    return <div ref={containerRef} />;
}
