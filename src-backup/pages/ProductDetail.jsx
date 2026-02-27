import React, { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { projecten } from "../data/ProjectsData";

function ProjectDetail() {
  const { id } = useParams();
  
  // Zoek huidig project
  const projectIndex = projecten.findIndex((p) => p.id.toString() === id.toString());
  const project = projecten[projectIndex];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  if (!project) {
    return (
      <div className="h-screen flex flex-col items-center justify-center">
        <h2 className="text-3xl font-light mb-4 tracking-tight">Project niet gevonden.</h2>
        <Link to="/" className="text-sm uppercase tracking-widest border-b border-black pb-1 hover:text-gray-600 transition-colors">
          Terug naar overzicht
        </Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen text-gray-900 selection:bg-black selection:text-white">
      <nav className="fixed top-0 w-full z-50 px-6 py-6 mix-blend-difference text-white flex justify-between items-center pointer-events-none">
        <Link to="/projects" className="pointer-events-auto flex items-center gap-2 group">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="transition-transform group-hover:-translate-x-1">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          <span className="text-sm font-medium tracking-wide">Back</span>
        </Link>
        <span className="hidden md:block text-xs font-bold uppercase tracking-widest opacity-80">
          Case {project.id} — {project.title}
        </span>
      </nav>

      {/* --- Hero Header --- */}
      <header className="relative pt-32 pb-16 md:pt-48 md:pb-24 px-6 container mx-auto max-w-7xl">
        <div className="max-w-4xl">
          <h1 className="text-5xl md:text-8xl lg:text-9xl font-semibold tracking-tighter leading-[0.9] mb-8">
            {project.title}
          </h1>
          {project.subtitle && (
            <p className="text-xl md:text-2xl text-gray-500 font-light max-w-2xl leading-relaxed">
              {project.subtitle}
            </p>
          )}
        </div>
      </header>
      {/* --- Content Grid --- */}
      <section className="container mx-auto px-6 max-w-7xl mb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          
          {/* Sidebar (Sticky) */}
          <aside className="lg:col-span-4 lg:sticky lg:top-32 h-fit space-y-12">
            
            {/* Project Info Block */}
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-8">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Klant</h3>
                <p className="text-lg font-medium">{project.client || "Onbekend"}</p>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Jaar</h3>
                <p className="text-lg font-medium">{project.year}</p>
              </div>
            </div>

            <div className="w-full h-px bg-gray-200"></div>

            {/* Services List */}
            {project.services && project.services.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Services</h3>
                <ul className="space-y-2">
                  {project.services.map((service, i) => (
                    <li key={i} className="text-base text-gray-800">{service}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Stack List */}
            {project.stack && project.stack.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Tech Stack</h3>
                <div className="flex flex-wrap gap-2">
                  {project.stack.map((tech, i) => (
                    <span key={i} className="px-3 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Visit Link */}
            {project.url && (
              <a 
                href={project.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-black border-b border-black pb-1 hover:opacity-70 transition-opacity"
              >
                <span>Bezoek Website</span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 11L11 1M11 1H3M11 1V9"/>
                </svg>
              </a>
            )}
          </aside>

          {/* Main Story Content */}
          <div className="lg:col-span-8 space-y-20">
            {project.challenge ? (
              <>
                <div className="prose prose-lg max-w-none">
                  <h3 className="text-2xl font-medium mb-6">De Uitdaging</h3>
                  <p className="text-gray-600 leading-relaxed text-xl font-light">
                    {project.challenge}
                  </p>
                </div>
                
                {/* Visual Break (Gallery Item 1) */}
                {project.gallery && project.gallery[0] && (
                  <div className="rounded-xl overflow-hidden border border-gray-100">
                     <img src={project.gallery[0]} alt="Detail view" className="w-full h-auto" />
                  </div>
                )}

                <div className="prose prose-lg max-w-none">
                  <h3 className="text-2xl font-medium mb-6">De Oplossing</h3>
                  <p className="text-gray-600 leading-relaxed text-lg">
                    {project.solution}
                  </p>
                  <p className="text-gray-600 leading-relaxed text-lg mt-4">
                    {project.description}
                  </p>
                </div>

                 {project.gallery && project.gallery[1] && (
                  <div className="rounded-xl overflow-hidden border border-gray-100">
                     <img src={project.gallery[1]} alt="Detail view" className="w-full h-auto" />
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-start justify-center h-64 border-l-2 border-gray-100 pl-8">
                 <p className="text-2xl text-gray-400 font-light italic">Informatie over dit project volgt binnenkort.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default ProjectDetail;