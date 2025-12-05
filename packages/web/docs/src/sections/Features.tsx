import React from 'react';
import { Zap, Shield, FileCode, Smartphone } from 'lucide-react';

const features = [
    {
        icon: <Shield className="w-8 h-8 text-brand-primary" />,
        title: 'Type-Safe',
        description: 'Built with TypeScript for full type definitions.'
    },
    {
        icon: <Zap className="w-8 h-8 text-brand-primary" />,
        title: 'Zero Config',
        description: 'Sensible defaults allow you to start sending emails and notifications in minutes.'
    },
    {
        icon: <FileCode className="w-8 h-8 text-brand-primary" />,
        title: 'Zero Dependencies',
        description: 'Lightweight and efficient.'
    },
    {
        icon: <Smartphone className="w-8 h-8 text-brand-primary" />,
        title: 'Multi-Channel',
        description: 'Unified API for sending notifications via Gmail and Telegram Bots.'
    }
];

const Features: React.FC = () => {
    return (
        <section id="features" className="py-24 bg-white border-t border-slate-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-r border-l border-neutral-300">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
                    {features.map((feature, index) => (
                        <div key={index} className="group">
                            <div className="mb-6 opacity-80 group-hover:opacity-100 transition-opacity">
                                {feature.icon}
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                            <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Features;
