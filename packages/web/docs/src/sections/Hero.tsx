import React, { useState } from 'react';
import { Check, Copy, ArrowRight } from 'lucide-react';

const Hero: React.FC = () => {
    const [copied, setCopied] = useState(false);
    const installCmd = 'npm install monkmail';

    const handleCopy = () => {
        navigator.clipboard.writeText(installCmd);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <section className="pt-40 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-primary/5 text-brand-primary text-sm font-medium mb-8 border border-brand-primary/10">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full bg-brand-primary opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 bg-brand-primary"></span>
                </span>
                v1.0.5 Now available
            </div>

            <h1 className="text-6xl md:text-6xl font-medium tracking-tighter text-slate-900 mb-8">
                Monkmail
            </h1>

            <p className="mt-6 max-w-2xl mx-auto text-xl text-slate-600 mb-12 font-light">
                A lightweight, type-safe library for handling emails and Telegram notifications in your Node.js applications.
            </p>

            <div className="flex flex-col  items-center justify-center gap-3">
                <div
                    className="group flex items-center bg-slate-900 text-white px-8 py-4 font-mono text-sm transition-all cursor-pointer hover:bg-black"
                    onClick={handleCopy}
                >
                    <span className="mr-6">$ {installCmd}</span>
                    <button className="text-slate-400 group-hover:text-white transition-colors">
                        {copied ? <Check size={16} className="" /> : <Copy size={16} />}
                    </button>
                </div>
                <a
                    href="https://github.com/mizurex/monk_mailer"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-6 py-2 bg-brand-primary text-white font-semibold hover:bg-brand-dark transition-colors"
                >
                    View on GitHub <ArrowRight size={18} />
                </a>
            </div>
        </section>
    );
};

export default Hero;
