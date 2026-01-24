import { projecten } from "../data/ProjectsData";

function Projects() {
  return (
    <section className="overflow-hidden">
      <div className="container mx-auto px-6 md:px-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-24 gap-10">
          <div className="max-w-2xl">
            <span className="text-sm font-bold tracking-widest uppercase text-gray-400 mb-4 block">
              Portfolio
            </span>
            <h3 className="text-4xl md:text-7xl font-semibold text-gray-900 leading-tight">
              Geselecteerde <br />
              <span className="italic font-light text-gray-500">Projecten</span>
            </h3>
          </div>
          <div className="max-w-md">
            <p className="text-lg text-gray-600 font-light leading-relaxed">
              Mijn beste UX-projecten op een rij. Slim bedacht, mooi ontworpen en technisch goed uitgevoerd. Ik houd van werk dat tot in de puntjes klopt.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-16 lg:gap-x-24">
          {projecten.map((project, index) => (
            <div
              key={project.id}
              className={`group block cursor-pointer ${
                index % 2 !== 0 ? "md:pt-32" : ""
              }`}
            >
              <div className="relative overflow-hidden rounded-[2rem] bg-gray-100 aspect-[4/3] mb-8 transition-all duration-700 ease-out group-hover:shadow-2xl group-hover:shadow-black/5">
                <div className="absolute top-6 left-6 z-20">
                  <span className="bg-white/90 backdrop-blur-md text-gray-900 text-xs font-bold px-4 py-2 rounded-full border border-white/50 shadow-sm uppercase tracking-wider">
                    Case {project.id}
                  </span>
                </div>

                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-700 z-10" />

                <img
                  className="w-full h-full object-cover transform transition-transform duration-1000 ease-out group-hover:scale-110"
                  src={project.image}
                  alt={project.title}
                />
              </div>

              <div className="flex justify-between items-start gap-6 border-t border-gray-200/60 pt-6 group-hover:border-gray-400 transition-colors duration-500">
                <div className="max-w-md pb-4">
                  <h3 className="text-3xl font-medium text-gray-900 mb-2 group-hover:underline decoration-1 underline-offset-4 decoration-gray-400">
                    {project.title}
                  </h3>
                  <p className="text-gray-500 text-base font-light leading-relaxed">
                    {project.description}
                  </p>
                </div>

                <div className="hidden md:flex items-center justify-center w-14 h-14 rounded-full border border-gray-200 group-hover:bg-black group-hover:border-black transition-all duration-500 shrink-0">
                  <svg
                    className="w-6 h-6 text-gray-900 group-hover:text-white transform transition-transform duration-500 group-hover:-rotate-45"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Projects;
