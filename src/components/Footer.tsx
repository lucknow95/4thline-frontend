"use client";

import Link from "next/link";

export default function Footer() {
    return (
        <footer className="bg-gray-900 text-gray-300 mt-12">
            <div className="max-w-6xl mx-auto px-4 py-10 grid gap-8 md:grid-cols-4">
                {/* Brand */}
                <div>
                    <h2 className="text-xl font-bold text-white">4th Line Fantasy</h2>
                    <p className="mt-2 text-sm text-gray-400">
                        Fantasy hockey tools & insights to give you the edge.
                    </p>
                </div>

                {/* Navigation */}
                <div>
                    <h3 className="text-sm font-semibold text-white uppercase mb-3">
                        Navigation
                    </h3>
                    <ul className="space-y-2 text-sm">
                        <li>
                            <Link href="/" className="hover:text-orange-400">
                                Home
                            </Link>
                        </li>
                        <li>
                            <Link href="/rankings" className="hover:text-orange-400">
                                Rankings
                            </Link>
                        </li>
                        <li>
                            <Link href="/blog" className="hover:text-orange-400">
                                Blog
                            </Link>
                        </li>
                        <li>
                            <Link href="/newsletter" className="hover:text-orange-400">
                                Newsletter
                            </Link>
                        </li>
                        <li>
                            <Link href="/merch" className="hover:text-orange-400">
                                Merch
                            </Link>
                        </li>
                        <li>
                            <Link href="/crunch-palace" className="hover:text-orange-400">
                                Crunch Palace
                            </Link>
                        </li>
                    </ul>
                </div>

                {/* Legal */}
                <div>
                    <h3 className="text-sm font-semibold text-white uppercase mb-3">
                        Legal
                    </h3>
                    <ul className="space-y-2 text-sm">
                        <li>
                            <Link href="/terms" className="hover:text-orange-400">
                                Terms of Service
                            </Link>
                        </li>
                        <li>
                            <Link href="/privacy" className="hover:text-orange-400">
                                Privacy Policy
                            </Link>
                        </li>
                    </ul>
                </div>

                {/* Contact */}
                <div>
                    <h3 className="text-sm font-semibold text-white uppercase mb-3">
                        Contact
                    </h3>
                    <p className="text-sm">
                        <a
                            href="mailto:support@4thlinefantasy.com"
                            className="hover:text-orange-400"
                        >
                            support@4thlinefantasy.com
                        </a>
                    </p>
                </div>
            </div>

            {/* Bottom bar */}
            <div className="border-t border-gray-700 py-4 text-center text-xs text-gray-500">
                © {new Date().getFullYear()} 4th Line Fantasy. All rights reserved.
            </div>
        </footer>
    );
}
