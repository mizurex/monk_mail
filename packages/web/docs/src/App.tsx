import Navbar from './components/Navbar';
import Hero from './sections/Hero';
import Features from './sections/Features';

function App() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main>
        <Hero />
        <Features />
      </main>

      <footer className="bg-white border-t border-slate-100 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center text-slate-500 text-sm">
          <p>© {new Date().getFullYear()} Monkmail.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="https://github.com/mizurex/monk_mailer" className="hover:text-brand-primary transition-colors">GitHub</a>
            <a href="https://www.npmjs.com/package/monkmail" className="hover:text-brand-primary transition-colors">npm</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
