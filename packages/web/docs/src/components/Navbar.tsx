import React from 'react';
import { Github, Menu, X } from 'lucide-react';

const Navbar: React.FC = () => {
    const [isOpen, setIsOpen] = React.useState(false);

    return (
        <nav className="fixed top-0 w-full bg-white/90 backdrop-blur-sm border-b border-slate-100 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">


                    <div className="hidden md:flex items-center space-x-8">
                        <a href="#features" className="text-slate-600 hover:text-brand-primary transition-colors font-medium">Features</a>
                        <a
                            href="https://github.com/mizurex/monk_mailer"
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 text-slate-900 hover:text-brand-primary transition-colors font-medium"
                        >
                            <Github size={15} />
                            <span>GitHub</span>
                        </a>
                    </div>

                    <div className="md:hidden flex items-center">
                        <button onClick={() => setIsOpen(!isOpen)} className="text-slate-600">
                            {isOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile menu */}
            {isOpen && (
                <div className="md:hidden bg-white border-b border-slate-100">
                    <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                        <a href="#features" className="block px-3 py-2 text-slate-600 hover:text-brand-primary font-medium">Features</a>
                        <a href="https://github.com/mizurex/monk_mailer" className="block px-3 py-2 text-slate-600 hover:text-brand-primary font-medium">GitHub</a>
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
